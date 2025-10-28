import 'package:flutter/material.dart';

void main() {
  runApp(const GigvoraApp());
}

class GigvoraApp extends StatelessWidget {
  const GigvoraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gigvora Phone App',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF3B82F6)),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Gigvora Phone App'),
      ),
      body: const Center(
        child: Text(
          'Welcome to the Gigvora Phone App shell!',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
