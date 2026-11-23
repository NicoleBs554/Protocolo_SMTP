# Cliente de correo SMTP

Ejemplo educativo de un cliente de correo en Node.js que implementa el diálogo
SMTP directamente con los módulos nativos `net` y `tls`.

## Requisitos

- Node.js instalado (se recomienda una versión LTS).
- Una cuenta de correo con acceso SMTP habilitado.
- Credenciales SMTP válidas. Para Gmail, usa una contraseña de aplicación;
  no uses la contraseña normal de tu cuenta.

## Instalación

El proyecto no requiere dependencias externas. Desde PowerShell, en la carpeta
del proyecto, puedes instalar las dependencias (si las hubiera) con:

```powershell
npm.cmd install
```

## Configuración y ejecución

Configura las variables en la misma ventana de PowerShell donde ejecutarás el
cliente. No escribas las credenciales directamente en `cliente.js` ni las
guardes en el repositorio.

Ejemplo para Gmail usando STARTTLS en el puerto 587:

```powershell
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_SECURE = "false"
$env:SMTP_USER = "tu-cuenta@gmail.com"
$env:SMTP_PASS = "tu-contraseña-de-aplicacion"
$env:MAIL_TO = "destinatario@ejemplo.com"
npm.cmd start
```

Para otro proveedor, sustituye el host, puerto y credenciales por los valores
que indique ese proveedor. El puerto 465 usa TLS desde el inicio
(`SMTP_SECURE=true`); el puerto 587 usa STARTTLS y el cliente cancela la
conexión si el servidor no lo ofrece:

```powershell
$env:SMTP_HOST = "smtp.proveedor.example"
$env:SMTP_PORT = "587"
$env:SMTP_SECURE = "false"
$env:SMTP_USER = "usuario@ejemplo.com"
$env:SMTP_PASS = "tu-clave-smtp"
$env:MAIL_TO = "destinatario@ejemplo.com"
npm.cmd start
```

Si no defines `SMTP_HOST`, se usa `smtp.gmail.com`. Si no defines
`SMTP_PORT`, se usa `587`; el modo seguro se deduce del puerto (465 = TLS desde
el inicio; 587 = STARTTLS).
`SMTP_USER`, `SMTP_PASS` y `MAIL_TO` son obligatorias. El programa envía un
correo real a `MAIL_TO`.

El cliente lee respuestas SMTP completas (incluidas las multilínea), negocia
STARTTLS antes de autenticar cuando usa una conexión no implícitamente segura,
y codifica el asunto y el cuerpo para UTF-8. Al terminar correctamente verás la
respuesta del servidor tras el envío. Si falla, revisa las credenciales, los
datos SMTP y que la red permita conexiones salientes al puerto indicado. El
proceso termina con código distinto de cero cuando ocurre un error.

Esta implementación es educativa; no reemplaza una biblioteca SMTP para uso
en producción, que cubre más mecanismos de autenticación y formatos MIME.

## Comprobación local

Para comprobar la sintaxis sin conectar ni enviar correo:

```powershell
node --check .\cliente.js
```

Para probar la conexión y el envío real, ejecuta `npm.cmd start` después de
configurar las variables. Las variables solo se conservan en la ventana actual
de PowerShell; ciérrala para descartarlas.