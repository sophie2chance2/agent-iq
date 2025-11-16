#!/usr/bin/env python3
"""
Simple HTTP server for serving the D3 metrics dashboard
"""

import http.server
import socketserver
import os
import sys
import webbrowser
import threading
import time

def start_server(port=8000, directory=None):
    """Start HTTP server"""
    if directory:
        os.chdir(directory)
    
    handler = http.server.SimpleHTTPRequestHandler
    
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Metrics Dashboard Server")
        print(f"Serving directory: {os.getcwd()}")
        print(f"Server running at: http://localhost:{port}")
        
        # Determine the correct dashboard URL based on serving directory
        current_dir = os.path.basename(os.getcwd())
        if current_dir == 'dataviz':
            dashboard_url = f"http://localhost:{port}/index.html"
            print(f"Dashboard URL: {dashboard_url}")
        else:
            dashboard_url = f"http://localhost:{port}/dataviz/index.html"
            print(f"Dashboard URL: {dashboard_url}")
            print(f"Alternative URL: http://localhost:{port}/dataviz/")
        
        print("Press Ctrl+C to stop the server")
        
        # Open browser after a short delay
        def open_browser():
            time.sleep(1)
            webbrowser.open(dashboard_url)
        
        browser_thread = threading.Thread(target=open_browser)
        browser_thread.daemon = True
        browser_thread.start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")
            httpd.shutdown()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Serve D3 Metrics Dashboard')
    parser.add_argument('--port', type=int, default=8000, help='Port to serve on (default: 8000)')
    parser.add_argument('--dir', type=str, default='.', help='Directory to serve (default: current)')
    
    args = parser.parse_args()
    
    start_server(args.port, args.dir)
