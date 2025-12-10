import 'package:http/http.dart' as http;

Future<http.Response> authorizedGet(String url, String token) {
  return http.get(
    Uri.parse(url),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
  );
}
