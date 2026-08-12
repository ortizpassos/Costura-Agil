// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:costura_agil/main.dart';

void main() {
  testWidgets('App builds and shows home screen', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const CosturaAgilApp());

    // Verify that the home screen is displayed (check for a text that should be there)
    expect(find.text('Controle sua Produção com Eficiência'), findsOneWidget);
  });
}
