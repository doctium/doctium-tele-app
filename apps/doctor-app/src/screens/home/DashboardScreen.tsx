import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>My Dashboard</Text>
        </View>

        <View style={styles.earningsCard}>
          <Text style={styles.cardLabel}>Today's Earnings</Text>
          <Text style={styles.earningsAmount}>₦0.00</Text>
          <Text style={styles.cardLabel}>This Month: ₦0.00</Text>
        </View>

        <View style={styles.statsRow}>
          {/* Stats: Patients Today | Appointments | Rating */}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
          {/* AppointmentCard list */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text.primary },
  earningsCard: {
    margin: 20,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 24,
  },
  cardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  earningsAmount: { color: '#fff', fontSize: 32, fontWeight: '700', marginVertical: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginBottom: 12 },
});
