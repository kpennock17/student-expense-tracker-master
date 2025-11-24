import React, { useEffect, useState, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

const getWeekStart = () => {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
  const start = new Date(date.setDate(diff));
  return start.toISOString().split('T')[0];
};

const getMonthStart = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().split('T')[0];
};

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  
  const [filter, setFilter] = useState('All');

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const loadExpenses = async (currentFilter = filter) => {
    let whereClause = '';
    const now = new Date().toISOString().split('T')[0];

    if (currentFilter === 'This Week') {
      const weekStart = getWeekStart();
      whereClause = `WHERE date >= '${weekStart}' AND date <= '${now}'`;
    } else if (currentFilter === 'This Month') {
      const monthStart = getMonthStart();
      whereClause = `WHERE date >= '${monthStart}' AND date <= '${now}'`;
    }

    const query = `SELECT * FROM expenses ${whereClause} ORDER BY date DESC, id DESC;`;
    const rows = await db.getAllAsync(query);

    setExpenses(rows);
    setFilter(currentFilter);
  };

  useEffect(() => {
    async function setup() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT NOT NULL
        );
      `);

      await loadExpenses('All');
    }

    setup();
  }, []);

  useEffect(() => {
    loadExpenses(filter);
  }, [filter]);


  const addExpense = async () => {
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid amount and category.");
      return;
    }
    if (!category.trim()) {
      Alert.alert("Invalid Input", "Category is required.");
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();
    const today = new Date().toISOString().split('T')[0];

    await db.runAsync(
      'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
      [amountNumber, trimmedCategory, trimmedNote || null, today]
    );

    setAmount('');
    setCategory('');
    setNote('');

    loadExpenses();
  };

  const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    loadExpenses();
  };

  const updateExpense = async () => {
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0 || !category.trim() || editId === null) {
      Alert.alert("Invalid Input", "Please correct the input fields.");
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();

    await db.runAsync(
      `UPDATE expenses
       SET amount = ?, category = ?, note = ?
       WHERE id = ?;`,
      [amountNumber, trimmedCategory, trimmedNote || null, editId]
    );

    setIsEditing(false);
    setEditId(null);
    setAmount('');
    setCategory('');
    setNote('');

    loadExpenses(); 
  };

  const handleEditPress = (item) => {
    setEditId(item.id);
    setAmount(item.amount.toString());
    setCategory(item.category);
    setNote(item.note);
    setIsEditing(true);
  };
  
  const renderExpense = ({ item }) => (
    <TouchableOpacity onPress={() => handleEditPress(item)} style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        <Text style={styles.expenseDate}>{item.date}</Text>
      </View>

      <TouchableOpacity onPress={() => deleteExpense(item.id)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const { overallTotal, categoryTotals } = useMemo(() => {
    const total = expenses.reduce((acc, expense) => acc + expense.amount, 0);
    const categoryMap = expenses.reduce((map, expense) => {
        const cat = expense.category;
        map[cat] = (map[cat] || 0) + expense.amount;
        return map;
    }, {});

    const categoryList = Object.keys(categoryMap)
        .map(category => ({
            category,
            total: categoryMap[category],
        }))
        .sort((a, b) => b.total - a.total); 

    return {
        overallTotal: total,
        categoryTotals: categoryList,
    };
  }, [expenses]);
  
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>

      {/* Task 1B: Filter Buttons */}
      <View style={styles.filterContainer}>
          <TouchableOpacity onPress={() => setFilter('All')} style={[styles.filterButton, filter === 'All' && styles.activeFilter]}>
              <Text style={styles.filterText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilter('This Week')} style={[styles.filterButton, filter === 'This Week' && styles.activeFilter]}>
              <Text style={styles.filterText}>This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFilter('This Month')} style={[styles.filterButton, filter === 'This Month' && styles.activeFilter]}>
              <Text style={styles.filterText}>This Month</Text>
          </TouchableOpacity>
      </View>

      {/* Input Form (Used for both Add and Edit) */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Amount (e.g. 12.50)"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Category (Food, Books, Rent...)"
          placeholderTextColor="#9ca3af"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#9ca3af"
          value={note}
          onChangeText={setNote}
        />
        {/* Task 3: Conditional Button for Add/Edit */}
        <Button
          title={isEditing ? "Save Changes" : "Add Expense"}
          onPress={isEditing ? updateExpense : addExpense}
          color={isEditing ? "#4ade80" : "#3b82f6"} 
        />
        {isEditing && (
            <View style={{marginTop: 8}}>
                <Button
                    title="Cancel Edit"
                    onPress={() => { setIsEditing(false); setEditId(null); setAmount(''); setCategory(''); setNote(''); }}
                    color="#f87171"
                />
            </View>
        )}
      </View>

      {/* Task 2: Totals Display */}
      <View style={styles.totalsContainer}>
          <Text style={styles.totalHeading}>
              Total Spending ({filter}):
              <Text style={styles.overallTotalText}> ${overallTotal.toFixed(2)}</Text>
          </Text>

          <Text style={styles.categoryHeading}>By Category:</Text>
          {categoryTotals.map(({ category, total }) => (
              <View key={category} style={styles.categoryRow}>
                  <Text style={styles.categoryText}>{category}</Text>
                  <Text style={styles.categoryTotalText}>${total.toFixed(2)}</Text>
              </View>
          ))}
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={
          <Text style={styles.empty}>No expenses yet for this filter.</Text>
        }
      />

      <Text style={styles.footer}>
        Enter your expenses and they’ll be saved locally with SQLite. Tap an entry to edit.
      </Text>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    padding: 4,
    backgroundColor: '#1f2937',
    borderRadius: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  filterText: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  activeFilter: {
    backgroundColor: '#374151',
  },

  totalsContainer: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#fbbf24',
  },
  totalHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  overallTotalText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4ade80', 
  },
  categoryHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  categoryText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  categoryTotalText: {
    color: '#fbbf24',
    fontWeight: '700',
    fontSize: 14,
  },
  
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  expenseDate: { 
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  delete: {
    color: '#f87171',
    fontSize: 20,
    marginLeft: 12,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
    fontSize: 12,
  },
});