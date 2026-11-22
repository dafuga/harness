from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ssl
import subprocess


class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'<!doctype html><title>Vault fixture</title><h1>Approved synthetic origin</h1>'
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


subprocess.run(
    ['openssl', 'req', '-newkey', 'rsa:2048', '-nodes', '-x509', '-days', '1',
     '-subj', '/CN=console.example.test', '-keyout', '/tmp/fixture-key.pem',
     '-out', '/tmp/fixture-cert.pem'],
    check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
server = ThreadingHTTPServer(('0.0.0.0', 443), Fixture)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('/tmp/fixture-cert.pem', '/tmp/fixture-key.pem')
server.socket = context.wrap_socket(server.socket, server_side=True)
server.serve_forever()
