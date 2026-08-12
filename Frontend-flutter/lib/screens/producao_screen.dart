import 'package:flutter/material.dart';

class ProducaoScreen extends StatelessWidget {
  const ProducaoScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Produção')),
      body: Center(
        child: Text('Tela de Produção', style: TextStyle(fontSize: 24)),
      ),
    );
  }
}
