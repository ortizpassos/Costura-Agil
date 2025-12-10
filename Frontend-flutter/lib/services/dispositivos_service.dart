import 'package:http/http.dart' as http;
import 'dart:convert';

class DispositivosService {
  static const _baseUrl = 'http://localhost:3000'; // Ajuste conforme necessário

  Future<List<dynamic>> getDispositivos(String token) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/api/dispositivos'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return [];
  }
}
