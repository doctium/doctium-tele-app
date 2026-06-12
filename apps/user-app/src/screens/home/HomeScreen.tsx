import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.name}>Welcome to Doctium</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {/* QuickAction cards: Find Doctor, My Appointments, Chat, Health Tips */}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Doctors</Text>
          {/* DoctorCard horizontal scroll list */}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Videos</Text>
          {/* VideoCard horizontal scroll list */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  greeting: { fontSize: 14, color: Colors.text.secondary },
  name: { fontSize: 22, fontWeight: '700', color: Colors.text.primary },
  quickActions: { paddingHorizontal: 20, marginTop: 8 },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginBottom: 12 },
});
