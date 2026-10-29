# Cliente de correo SMTP

Ejemplo mínimo de un cliente de correo en Node.js que se conecta a un servidor
SMTP mediante Nodemailer, verifica la conexión y envía un correo de prueba.

## Requisitos

- Node.js instalado (se recomienda una versión LTS).
- Una cuenta de correo con acceso SMTP habilitado.
- Credenciales SMTP válidas. Para Gmail, usa una contraseña de aplicación;
  no uses la contraseña normal de tu cuenta.

## Instalación

Desde PowerShell, en la carpeta del proyecto:

```powershell
npm.cmd install
```

## Configuración y ejecución

Configura las variables en la misma ventana de PowerShell donde ejecutarás el
cliente. No escribas las credenciales directamente en `cliente.js` ni las
guardes en el repositorio.

Ejemplo para Gmail usando SSL/TLS en el puerto 465:

```powershell
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "465"
$env:SMTP_SECURE = "true"
$env:SMTP_USER = "tu-cuenta@gmail.com"
$env:SMTP_PASS = "tu-contraseña-de-aplicacion"
$env:MAIL_TO = "destinatario@ejemplo.com"
npm.cmd start
```

Para otro proveedor, sustituye el host, puerto y credenciales por los valores
que indique ese proveedor. El puerto 465 usa TLS desde el inicio
(`SMTP_SECURE=true`); el puerto 587 normalmente usa STARTTLS
(`SMTP_SECURE=false`):

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
`SMTP_PORT`, se usa `465`; el modo seguro se deduce del puerto (465 = seguro).
`SMTP_USER`, `SMTP_PASS` y `MAIL_TO` son obligatorias. El programa envía un
correo real a `MAIL_TO`.

Al terminar correctamente verás un mensaje de conexión y la respuesta del
servidor tras el envío. Si falla, revisa las credenciales, los datos SMTP y que
la red permita conexiones salientes al puerto indicado. El proceso termina con
código distinto de cero cuando ocurre un error.

## Comprobación local

Para comprobar la sintaxis sin conectar ni enviar correo:

```powershell
node --check .\cliente.js
```

Para probar la conexión y el envío real, ejecuta `npm.cmd start` después de
configurar las variables. Las variables solo se conservan en la ventana actual
de PowerShell; ciérrala para descartarlas.