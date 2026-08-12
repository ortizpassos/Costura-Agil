import 'package:flutter/material.dart';

class DisplayScreen extends StatelessWidget {
  const DisplayScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Display')),
      body: Center(
        child: Text('Tela de Display', style: TextStyle(fontSize: 24)),
      ),
    );
  }
}
