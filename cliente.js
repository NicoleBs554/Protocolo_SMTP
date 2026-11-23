// Cliente SMTP educativo basado en los módulos nativos net y tls de Node.js.
const net = require('net');
const tls = require('tls');

const RESPONSE_TIMEOUT_MS = 30000;
const MAX_RESPONSE_SIZE = 64 * 1024;

function getConfig() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secureSetting = process.env.SMTP_SECURE;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.MAIL_TO;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT debe ser un número entero entre 1 y 65535.');
  }

  if (secureSetting !== undefined && !['true', 'false'].includes(secureSetting.toLowerCase())) {
    throw new Error('SMTP_SECURE debe ser "true" o "false".');
  }

  if (!user || !pass || !to) {
    throw new Error('Configura SMTP_USER, SMTP_PASS y MAIL_TO antes de iniciar el cliente.');
  }

  for (const [name, address] of [['SMTP_USER', user], ['MAIL_TO', to]]) {
    if (/[\r\n<>]/.test(address) || !/^[^\s@]+@[^\s@]+$/.test(address)) {
      throw new Error(`${name} debe contener una dirección de correo válida.`);
    }
  }

  if (/[\r\n]/.test(host)) {
    throw new Error('SMTP_HOST no puede contener saltos de línea.');
  }

  return {
    host,
    port,
    secure: secureSetting === undefined ? port === 465 : secureSetting.toLowerCase() === 'true',
    user,
    pass,
    to,
  };
}

function waitForConnection(socket, eventName) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Tiempo de conexión SMTP agotado.')), RESPONSE_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      socket.removeListener(eventName, onConnected);
      socket.removeListener('error', onError);
      socket.removeListener('close', onClose);
    }

    function finish(error) {
      cleanup();
      if (error) reject(error);
      else resolve();
    }

    function onConnected() {
      finish();
    }

    function onError(error) {
      finish(error);
    }

    function onClose() {
      finish(new Error('La conexión SMTP se cerró antes de establecerse.'));
    }

    socket.once(eventName, onConnected);
    socket.once('error', onError);
    socket.once('close', onClose);
  });
}

function createSocketState(socket) {
  const state = {
    buffer: '',
    error: undefined,
    closed: false,
    rejectPending: undefined,
    cleanup: undefined,
  };
  const onError = (error) => {
    state.error = error;
    if (state.rejectPending) state.rejectPending(error);
  };
  const onClose = () => {
    state.closed = true;
    if (state.rejectPending) {
      state.rejectPending(new Error('La conexión SMTP se cerró antes de recibir una respuesta.'));
    }
  };

  socket.on('error', onError);
  socket.on('close', onClose);
  state.cleanup = () => {
    socket.removeListener('error', onError);
    socket.removeListener('close', onClose);
  };
  return state;
}

function readResponse(socket, state, write) {
  return new Promise((resolve, reject) => {
    if (state.error) {
      reject(state.error);
      return;
    }
    if (state.closed || socket.destroyed) {
      reject(new Error('La conexión SMTP se cerró antes de recibir una respuesta.'));
      return;
    }

    let responseLines = [];
    let responseCode;
    let buffer = state.buffer;
    let finished = false;
    const timer = setTimeout(() => finish(new Error('Tiempo de espera agotado al recibir una respuesta SMTP.')), RESPONSE_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      socket.removeListener('data', onData);
      socket.removeListener('end', onEnd);
      socket.removeListener('close', onClose);
      if (state.rejectPending === finish) state.rejectPending = undefined;
    }

    function finish(error, response) {
      if (finished) return;
      finished = true;
      cleanup();
      state.buffer = buffer;
      if (error) reject(error);
      else resolve(response);
    }

    function onData(data) {
      if (data) buffer += data.toString('utf8');
      if (buffer.length > MAX_RESPONSE_SIZE) {
        finish(new Error('La respuesta SMTP excede el tamaño permitido.'));
        return;
      }

      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const rawLine = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!rawLine.endsWith('\r')) {
          finish(new Error('El servidor SMTP devolvió una respuesta con formato inválido.'));
          return;
        }

        const line = rawLine.slice(0, -1);
        const match = /^(\d{3})([- ])(.*)$/.exec(line);
        if (!match) {
          finish(new Error('El servidor SMTP devolvió una respuesta con formato inválido.'));
          return;
        }

        const code = Number(match[1]);
        if (responseCode !== undefined && code !== responseCode) {
          finish(new Error('El servidor SMTP devolvió una respuesta multilínea inconsistente.'));
          return;
        }
        responseCode = code;
        responseLines.push(line);

        if (match[2] === ' ') {
          finish(undefined, { code, lines: responseLines });
          return;
        }
      }
    }

    function onEnd() {
      finish(new Error('El servidor SMTP cerró la conexión antes de responder.'));
    }

    function onClose() {
      finish(new Error('La conexión SMTP se cerró antes de recibir una respuesta.'));
    }

    socket.on('data', onData);
    socket.once('end', onEnd);
    socket.once('close', onClose);
    state.rejectPending = finish;

    onData();
    if (!finished) {
      try {
        write();
      } catch (error) {
        finish(error);
      }
    }
  });
}

async function sendCommand(socket, state, command, expectedCodes) {
  const response = await readResponse(socket, state, () => socket.write(`${command}\r\n`));
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`Comando SMTP rechazado (${response.code}): ${response.lines.join(' ')}`);
  }
  return response;
}

function getCapabilities(response) {
  return response.lines.map((line) => line.slice(4).trim().toUpperCase());
}

async function upgradeToTls(socket, host, state) {
  socket.removeAllListeners('data');
  const options = { socket };
  if (!net.isIP(host)) options.servername = host;

  const secureSocket = tls.connect(options);
  const secureState = createSocketState(secureSocket);
  try {
    await waitForConnection(secureSocket, 'secureConnect');
  } catch (error) {
    secureState.cleanup();
    secureSocket.destroy();
    throw error;
  }
  state.cleanup();
  return { socket: secureSocket, state: secureState };
}

async function authenticate(socket, state, capabilities, user, pass) {
  const authCapability = capabilities.find((capability) => /^AUTH(?:=|\s)/.test(capability));
  const mechanisms = authCapability
    ? authCapability.replace(/^AUTH=?\s*/, '').split(/\s+/)
    : [];

  if (mechanisms.includes('LOGIN')) {
    await sendCommand(socket, state, 'AUTH LOGIN', [334]);
    await sendCommand(socket, state, Buffer.from(user).toString('base64'), [334]);
    await sendCommand(socket, state, Buffer.from(pass).toString('base64'), [235]);
    return;
  }

  if (mechanisms.includes('PLAIN')) {
    const credentials = Buffer.from(`\0${user}\0${pass}`).toString('base64');
    const response = await sendCommand(socket, state, `AUTH PLAIN ${credentials}`, [235, 334]);
    if (response.code === 334) {
      await sendCommand(socket, state, credentials, [235]);
    }
    return;
  }

  throw new Error('El servidor SMTP no anuncia AUTH LOGIN ni AUTH PLAIN.');
}

function createMessage(user, to) {
  const subject = `=?UTF-8?B?${Buffer.from('Demostración SMTP').toString('base64')}?=`;
  const body = Buffer.from(
    'Hola, este correo fue enviado usando el protocolo SMTP desde Node.js.',
    'utf8',
  ).toString('base64').match(/.{1,76}/g).join('\r\n');

  return [
    `From: <${user}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
}

function terminateData(message) {
  const stuffed = message
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
  return `${stuffed.replace(/\r\n*$/, '')}\r\n.\r\n`;
}

async function sendMail(config) {
  let socket;
  let state;

  try {
    if (config.secure) {
      const options = { host: config.host, port: config.port };
      if (!net.isIP(config.host)) options.servername = config.host;
      socket = tls.connect(options);
      state = createSocketState(socket);
      await waitForConnection(socket, 'secureConnect');
    } else {
      socket = net.createConnection({ host: config.host, port: config.port });
      state = createSocketState(socket);
      await waitForConnection(socket, 'connect');
    }

    const greeting = await readResponse(socket, state, () => {});
    if (greeting.code !== 220) {
      throw new Error(`El servidor SMTP rechazó la conexión (${greeting.code}).`);
    }

    let ehlo = await sendCommand(socket, state, 'EHLO localhost', [250]);
    let capabilities = getCapabilities(ehlo);

    if (!config.secure) {
      if (!capabilities.some((capability) => /^STARTTLS(?:\s|$)/.test(capability))) {
        throw new Error('El servidor SMTP no ofrece STARTTLS; se cancela para proteger las credenciales.');
      }
      await sendCommand(socket, state, 'STARTTLS', [220]);
      const upgraded = await upgradeToTls(socket, config.host, state);
      socket = upgraded.socket;
      state = upgraded.state;
      ehlo = await sendCommand(socket, state, 'EHLO localhost', [250]);
      capabilities = getCapabilities(ehlo);
    }

    await authenticate(socket, state, capabilities, config.user, config.pass);
    await sendCommand(socket, state, `MAIL FROM:<${config.user}>`, [250]);
    await sendCommand(socket, state, `RCPT TO:<${config.to}>`, [250, 251]);
    await sendCommand(socket, state, 'DATA', [354]);

    const message = terminateData(createMessage(config.user, config.to));
    const sent = await readResponse(socket, state, () => socket.write(message));
    if (sent.code !== 250) {
      throw new Error(`El servidor SMTP no aceptó el mensaje (${sent.code}): ${sent.lines.join(' ')}`);
    }

    await sendCommand(socket, state, 'QUIT', [221]);
    console.log('📨 Correo enviado:', sent.lines.join(' '));
  } finally {
    if (state) state.cleanup();
    if (socket) socket.destroy();
  }
}

async function main() {
  const config = getConfig();
  console.log('Conectando al servidor SMTP...');
  await sendMail(config);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error SMTP:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { getConfig, sendMail };
