import 'package:flutter/material.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/cadastro_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/display_screen.dart';
import 'screens/producao_screen.dart';
import 'screens/settings_screen.dart';

void main() {
  runApp(const CosturaAgilApp());
}

class CosturaAgilApp extends StatelessWidget {
  const CosturaAgilApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Costura Ágil',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const HomeScreen(),
        '/login': (context) => const LoginScreen(),
        '/cadastro': (context) => const CadastroScreen(),
        '/dashboard': (context) => const DashboardScreen(),
        '/display': (context) => const DisplayScreen(),
        '/producao': (context) => const ProducaoScreen(),
        '/settings': (context) => const SettingsScreen(),
      },
    );
  }
}
