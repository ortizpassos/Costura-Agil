package com.costuraagil;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

public class SimpleHttpServer {
    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(3000), 0);
        server.createContext("/api/nfe/status", new StatusHandler());
        server.setExecutor(null);
        server.start();
        System.out.println("Servidor HTTP simples iniciado na porta 3000");
    }

    static class StatusHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String response = "Status do serviço SEFAZ: Serviço em Operação";
            exchange.sendResponseHeaders(200, response.length());
            OutputStream os = exchange.getResponseBody();
            os.write(response.getBytes());
            os.close();
        }
    }
}