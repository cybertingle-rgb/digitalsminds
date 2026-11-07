import ssl, sys, time, pathlib, email
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import AuthResult, LoginPassword

OUT = pathlib.Path(sys.argv[1])
class Handler:
    async def handle_DATA(self, server, session, envelope):
        name = OUT / f"{time.time_ns()}.eml"
        name.write_bytes(envelope.content)
        return "250 OK"

def authenticator(server, session, envelope, mechanism, auth_data):
    ok = isinstance(auth_data, LoginPassword) and auth_data.login == b"noreply@test.local" and auth_data.password == b"mail-pass-123"
    return AuthResult(success=ok, handled=False, message=None if ok else "535 5.7.8 Authentication credentials invalid")

ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
ctx.load_cert_chain("cert.pem", "key.pem")
c = Controller(Handler(), hostname="127.0.0.1", port=2525, tls_context=ctx, require_starttls=True,
               authenticator=authenticator, auth_required=True, auth_require_tls=True)
c.start(); print("smtp up", flush=True)
while True: time.sleep(3600)
