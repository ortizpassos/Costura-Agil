import 'package:http/http.dart' as http;
import 'dart:convert';

class ProducaoService {
  static const _baseUrl = 'http://localhost:3000'; // Ajuste conforme necessário

  Future<List<dynamic>> getProducao(String token) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/api/producao'),
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
