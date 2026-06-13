from http.server import BaseHTTPRequestHandler, HTTPServer
import os

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()
        self.wfile.write(b"I'm alive!")

    def log_message(self, format, *args):
        pass

port = int(os.environ.get("PORT", 8080))
print(f"Keepalive server running on port {port}")
HTTPServer(("0.0.0.0", port), Handler).serve_forever()
