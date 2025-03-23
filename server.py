from http.server import HTTPServer, SimpleHTTPRequestHandler


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


def run_server():
    server_address = ('localhost', 8000)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print("Server running at http://localhost:8000")
    print("Press Ctrl+C to stop the server")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()


if __name__ == '__main__':
    run_server() 