// DashboardScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Vibration,
  Animated,
  Badge,
} from 'react-native';
import { Audio } from 'expo-av';
import { getItems, getTasks, updateTaskReadStatus, updateTaskCheckStatus } from '../api';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// -------------------------------------------------------------------
// Cache keys
// -------------------------------------------------------------------
const CACHE_ITEMS_KEY = 'cached_items';
const CACHE_TASKS_KEY = 'cached_tasks';

// -------------------------------------------------------------------
// Deep equality helper
// -------------------------------------------------------------------
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
};

// -------------------------------------------------------------------
// Cache helpers
// -------------------------------------------------------------------
const loadFromCache = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveToCache = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache data', e);
  }
};

export default function DashboardScreen({ route, navigation }) {
  const { employeeId, employeeName, refresh, incomingCall: initialIncomingCall } = route.params || {};
  const [items, setItems] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [incomingCall, setIncomingCall] = useState(initialIncomingCall || null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const tasksPerPage = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const soundRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;

  // ---------------------------------------------------------------
  // Play/Stop Ringtone
  // ---------------------------------------------------------------
  const playRingtone = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/ringtone.mp3'),
        { shouldPlay: true, isLooping: true }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  };

  const stopRingtone = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping ringtone:', error);
    }
  };

  // ---------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------
  const handleLogout = async () => {
    try {
      setLoading(true);
      await AsyncStorage.multiRemove(['user', 'token', 'employeeId', 'employeeName']);
      navigation.replace('Login');
    } catch (error) {
      Alert.alert("Error", "Failed to log out.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------
  // Mark visible tasks as read
  // ---------------------------------------------------------------
  const markVisibleTasksAsRead = async (tasks) => {
    try {
      const unreadTasks = tasks.filter(task => {
        const readByList = task.read_by_list || [];
        return !readByList.includes(employeeId);
      });

      await Promise.all(
        unreadTasks.map(task =>
          updateTaskReadStatus(task.task_id, employeeId)
        )
      );
    } catch (error) {
      console.log("Failed to update read status:", error);
    }
  };

  // ---------------------------------------------------------------
  // Load data (cache first → API → update cache)
  // ---------------------------------------------------------------
  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);

    // 1. Load from cache
    if (!isRefresh) {
      const [cachedItems, cachedTasks] = await Promise.all([
        loadFromCache(CACHE_ITEMS_KEY),
        loadFromCache(CACHE_TASKS_KEY),
      ]);

      if (Array.isArray(cachedItems)) setItems(cachedItems);
      if (Array.isArray(cachedTasks)) setTasks(cachedTasks);

      if (cachedItems || cachedTasks) {
        setLoading(false);
        setRefreshing(true);
      }
    }

    // 2. Fetch fresh data
    try {
      const [itemsResponse, tasksResponse] = await Promise.all([
        getItems(),
        getTasks({ employeeId }),
      ]);

      const newItems = Array.isArray(itemsResponse) ? itemsResponse : [];
      const newTasks = Array.isArray(tasksResponse) ? tasksResponse : [];

      // Only update if changed
      setItems(prev => deepEqual(prev, newItems) ? prev : newItems);
      setTasks(prev => deepEqual(prev, newTasks) ? prev : newTasks);

      // Save to cache
      await Promise.all([
        saveToCache(CACHE_ITEMS_KEY, newItems),
        saveToCache(CACHE_TASKS_KEY, newTasks),
      ]);

      await markVisibleTasksAsRead(newTasks);

      if (incomingCall && !isRefresh) {
        playRingtone();
        Vibration.vibrate([500, 500], true);
      }

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error("Failed to load data:", error);
      Alert.alert("Error", "Failed to load data.");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setRefreshing(false);
      }, 300);
    }
  }, [employeeId, incomingCall]);

  // ---------------------------------------------------------------
  // Refresh handler
  // ---------------------------------------------------------------
  const handleRefresh = () => {
    loadData(true);
  };

  // ---------------------------------------------------------------
  // Incoming call handler
  // ---------------------------------------------------------------
  const handleAnswerCall = () => {
    stopRingtone();
    Vibration.cancel();
    setIncomingCall(null);
    navigation.setParams({ incomingCall: null });
  };

  // ---------------------------------------------------------------
  // Focus effect
  // ---------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        stopRingtone();
        Vibration.cancel();
      };
    }, [loadData])
  );

  // ---------------------------------------------------------------
  // Initial incoming call
  // ---------------------------------------------------------------
  useEffect(() => {
    if (initialIncomingCall) {
      setIncomingCall(initialIncomingCall);
      playRingtone();
      Vibration.vibrate([500, 500], true);
    }
    return () => {
      stopRingtone();
      Vibration.cancel();
    };
  }, [initialIncomingCall]);

  // ---------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------
  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = tasks.slice(indexOfFirstTask, indexOfLastTask);
  const totalPages = Math.ceil(tasks.length / tasksPerPage);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // ---------------------------------------------------------------
  // Check task
  // ---------------------------------------------------------------
  const handleCheckTask = () => {
    Alert.alert(
      "Confirm Check",
      "Are you sure you want to check this task?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            try {
              setLoading(true);
              await updateTaskCheckStatus(selectedTask.task_id, employeeId);
              setTasks(prevTasks =>
                prevTasks.map(t =>
                  t.task_id === selectedTask.task_id
                    ? {
                        ...t,
                        checked_by_list: [...(t.checked_by_list || []), employeeId],
                        checked_by_count: (t.checked_by_count || 0) + 1,
                      }
                    : t
                )
              );
              setSelectedTask(prev => ({
                ...prev,
                checked_by_list: [...(prev.checked_by_list || []), employeeId],
                checked_by_count: (prev.checked_by_count || 0) + 1,
              }));
            } catch (error) {
              Alert.alert("Error", "Failed to check task.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------
  // Theme & Modal
  // ---------------------------------------------------------------
  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const openTaskModal = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
    Animated.spring(modalAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const closeTaskModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowTaskModal(false));
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={50} color="#6366f1" />
          <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
            Loading from cache…
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Welcome, <Text style={styles.highlight}>{employeeName}</Text>
          </Text>
          <TouchableOpacity onPress={toggleTheme} disabled={loading}>
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={24}
              color={isDarkMode ? '#fff' : '#1f2937'}
            />
          </TouchableOpacity>
        </View>

        {/* Refreshing Badge */}
        {refreshing && (
          <View style={styles.refreshBadge}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.refreshText}>Refreshing…</Text>
          </View>
        )}

        {/* Search */}
        <TouchableOpacity
          style={[styles.searchBox, isDarkMode && styles.searchBoxDark]}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Ionicons name="search" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
          <Text style={[styles.searchText, isDarkMode && styles.searchTextDark]}>
            Search items...
          </Text>
        </TouchableOpacity>

        {/* Tasks */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Your Tasks
            </Text>

            {currentTasks.length > 0 ? (
              currentTasks.map(task => (
                <TouchableOpacity
                  key={task.task_id}
                  style={[
                    styles.taskItem,
                    isDarkMode && styles.taskItemDark,
                    task.status === 'completed' && styles.completedTask,
                  ]}
                  onPress={() => openTaskModal(task)}
                  disabled={loading}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.taskTitle, isDarkMode && styles.taskTitleDark]}>
                      {task.title}
                    </Text>
                    {task.read_by_list && !task.read_by_list.includes(employeeId) && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.taskDesc, isDarkMode && styles.taskDescDark]}>
                    {task.description || "No description provided"}
                  </Text>

                  {task.items && task.items.length > 0 && (
                    <View style={styles.itemsContainer}>
                      {task.items.map((item, index) => (
                        <Text key={item.item_id || index} style={[styles.taskItemText, isDarkMode && styles.taskItemTextDark]}>
                          • {item.item_name} (Required: {item.required_qty})
                        </Text>
                      ))}
                    </View>
                  )}

                  <View style={styles.footer}>
                    <Text style={[styles.taskStatus, isDarkMode && styles.taskStatusDark]}>
                      Status: {task.status === 'completed' ? 'Completed' : 'Pending'}
                    </Text>
                    <Text style={[styles.taskDate, isDarkMode && styles.taskDateDark]}>
                      {new Date(task.assigned_at).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
                No tasks assigned
              </Text>
            )}

            {/* Pagination */}
            {tasks.length > tasksPerPage && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.pageButton, isDarkMode && styles.pageButtonDark, currentPage === 1 && styles.disabledButton]}
                  onPress={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  <Text style={[styles.pageButtonText, isDarkMode && styles.pageButtonTextDark]}>
                    Previous
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.pageInfo, isDarkMode && styles.pageInfoDark]}>
                  Page {currentPage} of {totalPages}
                </Text>

                <TouchableOpacity
                  style={[styles.pageButton, isDarkMode && styles.pageButtonDark, currentPage === totalPages && styles.disabledButton]}
                  onPress={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  <Text style={[styles.pageButtonText, isDarkMode && styles.pageButtonTextDark]}>
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4f46e5' }]}
              onPress={() => navigation.navigate('Deduct', { employeeId, employeeName })}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Deduct Item</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4f46e5' }]}
              onPress={() => navigation.navigate('History', { employeeId })}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>My History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4f46e5' }]}
              onPress={() => navigation.navigate('Profile', { employeeId, employeeName })}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#dc2626' }]}
              onPress={handleLogout}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Incoming Call Overlay */}
      {incomingCall && (
        <Animated.View style={[styles.callContainer, { opacity: fadeAnim }]}>
          <View style={[styles.callBox, isDarkMode && styles.callBoxDark]}>
            <Text style={[styles.callTitle, isDarkMode && styles.callTitleDark]}>
              Incoming Task Call
            </Text>
            <Text style={[styles.callTask, isDarkMode && styles.callTaskDark]}>
              {incomingCall.taskTitle || "New Task"}
            </Text>
            <Text style={[styles.callDescription, isDarkMode && styles.callDescriptionDark]}>
              {incomingCall.taskDescription || "No description"}
            </Text>
            <View style={styles.callButtons}>
              <TouchableOpacity
                style={[styles.callButton, { backgroundColor: '#4f46e5' }]}
                onPress={handleAnswerCall}
              >
                <Text style={styles.callButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Task Modal */}
      <Modal visible={showTaskModal} transparent onRequestClose={closeTaskModal}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, isDarkMode && styles.modalContentDark, { transform: [{ scale: modalAnim }] }]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
              {selectedTask?.title}
            </Text>
            <Text style={[styles.modalDesc, isDarkMode && styles.modalDescDark]}>
              {selectedTask?.description || "No description"}
            </Text>

            {selectedTask?.items?.length > 0 && (
              <View style={styles.modalItemsContainer}>
                <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>Items:</Text>
                {selectedTask.items.map((item, i) => (
                  <Text key={i} style={[styles.modalItemText, isDarkMode && styles.modalItemTextDark]}>
                    • {item.item_name} (Required: {item.required_qty})
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.modalFooter}>
              <Text style={[styles.modalStatus, isDarkMode && styles.modalStatusDark]}>
                Status: {selectedTask?.status === 'completed' ? 'Completed' : 'Pending'}
              </Text>
              <Text style={[styles.modalDate, isDarkMode && styles.modalDateDark]}>
                {selectedTask?.assigned_at ? new Date(selectedTask.assigned_at).toLocaleDateString() : 'N/A'}
              </Text>
            </View>

            {/* ---- DEDUCT BUTTON (same as bottom nav) ---- */}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4f46e5', marginBottom: 12 }]}
              onPress={() => {
                closeTaskModal();
                navigation.navigate('Deduct', { employeeId, employeeName });
              }}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Deduct Item</Text>
            </TouchableOpacity>

            {selectedTask?.checked_by_list && !selectedTask.checked_by_list.includes(employeeId) ? (
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#4f46e5' }]}
                onPress={handleCheckTask}
              >
                <Text style={styles.modalButtonText}>Check Task</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.checkedMessage, isDarkMode && styles.checkedMessageDark]}>
                Task checked successfully
              </Text>
            )}

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#6b7280' }]}
              onPress={closeTaskModal}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  containerDark: {
    backgroundColor: '#1f2937',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
  },
  titleDark: {
    color: '#f9fafb',
  },
  highlight: {
    color: '#6366f1',
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  searchBoxDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  searchText: {
    marginLeft: 10,
    color: '#6b7280',
    fontSize: 16,
  },
  searchTextDark: {
    color: '#9ca3af',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#1f2937',
  },
  sectionTitleDark: {
    color: '#f9fafb',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 12,
  },
  emptyTextDark: {
    color: '#9ca3af',
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 16,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  loadingTextDark: {
    color: '#f9fafb',
  },
  refreshBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  refreshText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  taskItem: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  taskItemDark: {
    backgroundColor: '#374151',
    borderLeftColor: '#818cf8',
  },
  completedTask: {
    opacity: 0.85,
    borderLeftColor: '#10b981',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  taskTitle: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1f2937',
    flex: 1,
  },
  taskTitleDark: {
    color: '#f9fafb',
  },
  newBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  newBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  taskDesc: {
    color: '#6b7280',
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 22,
  },
  taskDescDark: {
    color: '#9ca3af',
  },
  itemsContainer: {
    marginBottom: 12,
  },
  taskItemText: {
    color: '#4b5563',
    fontSize: 14,
    marginLeft: 8,
    lineHeight: 20,
  },
  taskItemTextDark: {
    color: '#d1d5db',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskStatus: {
    color: '#6b7280',
    fontSize: 14,
  },
  taskStatusDark: {
    color: '#9ca3af',
  },
  taskDate: {
    color: '#6b7280',
    fontSize: 13,
  },
  taskDateDark: {
    color: '#9ca3af',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 12,
  },
  pageButton: {
    padding: 12,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  pageButtonDark: {
    backgroundColor: '#818cf8',
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
  },
  pageButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  pageButtonTextDark: {
    color: '#ffffff',
  },
  pageInfo: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  pageInfoDark: {
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modalContentDark: {
    backgroundColor: '#374151',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: '#1f2937',
  },
  modalTitleDark: {
    color: '#f9fafb',
  },
  modalDesc: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 24,
  },
  modalDescDark: {
    color: '#9ca3af',
  },
  modalItemsContainer: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1f2937',
  },
  modalSectionTitleDark: {
    color: '#f9fafb',
  },
  modalItemText: {
    fontSize: 15,
    color: '#4b5563',
    marginLeft: 12,
    lineHeight: 22,
  },
  modalItemTextDark: {
    color: '#d1d5db',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalStatus: {
    fontSize: 15,
    color: '#6b7280',
  },
  modalStatusDark: {
    color: '#9ca3af',
  },
  modalDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalDateDark: {
    color: '#9ca3af',
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  checkedMessage: {
    fontSize: 16,
    color: '#10b981',
    textAlign: 'center',
    marginVertical: 12,
  },
  checkedMessageDark: {
    color: '#34d399',
  },
  callContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  callBox: {
    backgroundColor: '#ffffff',
    width: '85%',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  callBoxDark: {
    backgroundColor: '#374151',
  },
  callTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: '#1f2937',
  },
  callTitleDark: {
    color: '#f9fafb',
  },
  callTask: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    color: '#1f2937',
  },
  callTaskDark: {
    color: '#f9fafb',
  },
  callDescription: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  callDescriptionDark: {
    color: '#9ca3af',
  },
  callButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  callButton: {
    padding: 16,
    borderRadius: 10,
    width: '70%',
    alignItems: 'center',
  },
  callButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});