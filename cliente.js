// Demostración de cliente SMTP con Node.js (Nodemailer)
const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = Number(process.env.SMTP_PORT || 465);
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

const secure = secureSetting === undefined ? port === 465 : secureSetting.toLowerCase() === 'true';

const config = {
  host,
  port,
  secure,
  auth: {
    user,
    pass,
  },
};

const cliente = nodemailer.createTransport(config);

async function main() {
  await cliente.verify();
  console.log('✅ Conectado al servidor SMTP');

  const info = await cliente.sendMail({
    from: user,
    to,
    subject: 'Demostración SMTP',
    text: 'Hola, este correo fue enviado usando el protocolo SMTP desde Node.js.',
  });

  console.log('📨 Correo enviado:', info.response);
}

main().catch((err) => {
  console.error('❌ Error SMTP:', err.message);
  process.exitCode = 1;
});
