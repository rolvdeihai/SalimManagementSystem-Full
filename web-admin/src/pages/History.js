// History.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Alert,
  Modal,
  Form,
  Row,
  Col,
  Container,
  Badge,
  Spinner,
} from 'react-bootstrap';
import { getHistory, updateHistory, deleteHistory } from '../api';
import DataTable from '../components/DataTable';

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
// Cache key
// -------------------------------------------------------------------
const CACHE_KEY = 'history_cached_data';

const History = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [editForm, setEditForm] = useState({ qty: '', action: '' });
  const [filter, setFilter] = useState({
    from: '',
    to: '',
    query: '',
  });

  // ---------------------------------------------------------------
  // Cache helpers
  // ---------------------------------------------------------------
  const loadFromCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveToCache = (data) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to cache history', e);
    }
  };

  // ---------------------------------------------------------------
  // Load history (cache first → API → update cache)
  // ---------------------------------------------------------------
  const loadHistory = useCallback(async (params = {}, forceRefresh = false) => {
    // 1. Load from cache (only on first mount)
    if (!forceRefresh) {
      const cached = loadFromCache();
      if (Array.isArray(cached)) {
        setHistory(cached);
        setLoading(false);
        setRefreshing(true);
      }
    }

    // 2. Fetch fresh data
    try {
      const data = await getHistory(params);
      const safeData = Array.isArray(data) ? data : [];

      // Only update if changed
      setHistory((prev) => (deepEqual(prev, safeData) ? prev : safeData));

      // Save to cache
      saveToCache(safeData);
    } catch (err) {
      setError('Failed to load history');
      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Refresh after CRUD
  const refreshHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getHistory();
      const safeData = Array.isArray(data) ? data : [];
      setHistory(safeData);
      saveToCache(safeData);
    } catch (err) {
      setError('Failed to refresh history');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------
  // Client-side filtering
  // ---------------------------------------------------------------
  const filteredHistory = history.filter((item) => {
    const q = filter.query.trim().toLowerCase();
    if (!q) return true;
    const itemName = String(item.item_name ?? '').toLowerCase();
    const employeeName = String(item.employee_name ?? '').toLowerCase();
    return itemName.includes(q) || employeeName.includes(q);
  });

  const dateFilteredHistory = filteredHistory.filter((item) => {
    if (!filter.from && !filter.to) return true;
    const itemDate = new Date(item.timestamp);
    let fromOk = true,
      toOk = true;
    if (filter.from)
      fromOk = itemDate >= new Date(filter.from + 'T00:00:00');
    if (filter.to) toOk = itemDate <= new Date(filter.to + 'T23:59:59');
    return fromOk && toOk;
  });

  // ---------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------
  const handleEdit = (entry) => {
    setEditEntry(entry);
    setEditForm({
      qty: entry.qty,
      action: entry.action,
    });
    setShowEditModal(true);
  };

  const handleDelete = async (entry) => {
    if (
      window.confirm(
        `Are you sure you want to delete this history entry?\n\n${JSON.stringify(
          entry,
          null,
          2
        )}`
      )
    ) {
      setLoading(true);
      setError('');
      try {
        await deleteHistory(entry.id);
        await refreshHistory();
      } catch (err) {
        setError('Failed to delete history entry');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditFormChange = (e) => {
    setEditForm((f) => ({
      ...f,
      [e.target.name]: e.target.value,
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await updateHistory({
        id: editEntry.id,
        qty: editForm.qty,
        action: editForm.action,
      });
      setShowEditModal(false);
      await refreshHistory();
    } catch (err) {
      setError('Failed to update history entry');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilter((f) => ({
      ...f,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFilterApply = () => {
    // Filters are client-side only
  };

  // ---------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------
  const columns = [
    {
      field: 'timestamp',
      header: 'Date',
      style: { width: 180, fontFamily: 'monospace', fontSize: 15, color: '#888' },
      render: (item) => (
        <span style={{ fontFamily: 'monospace', fontSize: 15, color: '#888' }}>
          {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
        </span>
      ),
    },
    {
      field: 'employee_name',
      header: 'Employee Name',
      style: { fontWeight: 700, color: '#23272b' },
    },
    {
      field: 'item_name',
      header: 'Item Name',
      style: { fontWeight: 700, color: '#23272b' },
    },
    {
      field: 'qty',
      header: 'Quantity',
      style: {
        textAlign: 'center',
        fontWeight: 700,
        color: '#23272b',
      },
    },
    {
      field: 'action',
      header: 'Action',
      render: (item) => (
        <span
          className={`badge ${item.action === 'deduct' ? 'bg-danger' : 'bg-success'}`}
          style={{
            fontSize: 14,
            padding: '8px 16px',
            borderRadius: 20,
            fontWeight: 600,
            textTransform: 'uppercase',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {item.action}
        </span>
      ),
    },
  ];

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (loading && !refreshing) {
    return (
      <Container
        fluid
        className="p-4 d-flex flex-column justify-content-center align-items-center"
        style={{ minHeight: '100vh' }}
      >
        <Spinner animation="border" variant="primary" />
        <span className="mt-3 text-muted">Loading cached history…</span>
      </Container>
    );
  }

  return (
    <Container
      fluid
      className="p-4"
      style={{
        background: 'transparent',
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-5 dashboard-header">
        <h2
          style={{
            fontWeight: 800,
            color: '#23272b',
            letterSpacing: 1.5,
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            animation: 'fadeIn 0.8s ease-out',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <i
            className="fas fa-history me-3 text-success"
            style={{ animation: 'bounce 2s infinite' }}
          ></i>
          History
        </h2>

        <div className="d-flex align-items-center gap-3">
          {refreshing && (
            <Badge bg="info" className="d-flex align-items-center px-3 py-2">
              <Spinner animation="border" size="sm" className="me-2" />
              Refreshing…
            </Badge>
          )}
          <Button
            variant="primary"
            onClick={() => loadHistory({}, true)}
            disabled={loading}
            style={{
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 16,
              padding: '12px 24px',
              boxShadow: '0 4px 15px rgba(52,152,219,0.3)',
              transition: 'all 0.3s ease',
              background: 'linear-gradient(90deg, #0d6efd 0%, #0a58ca 100%)',
            }}
            className="hover-scale"
          >
            <i className="fas fa-sync-alt me-2"></i> Refresh
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <div
        className="card mb-4 p-4"
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
          boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
        }}
      >
        <Form>
          <Row className="align-items-end g-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>From</Form.Label>
                <Form.Control
                  type="date"
                  name="from"
                  value={filter.from}
                  onChange={handleFilterChange}
                  disabled={loading}
                  style={{
                    borderRadius: 12,
                    background: '#fff',
                    fontSize: 16,
                    padding: '12px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    border: 'none',
                  }}
                  className="hover-scale-input"
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Until</Form.Label>
                <Form.Control
                  type="date"
                  name="to"
                  value={filter.to}
                  onChange={handleFilterChange}
                  disabled={loading}
                  style={{
                    borderRadius: 12,
                    background: '#fff',
                    fontSize: 16,
                    padding: '12px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    border: 'none',
                  }}
                  className="hover-scale-input"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Search</Form.Label>
                <Form.Control
                  type="text"
                  name="query"
                  placeholder="Search by item or employee name..."
                  value={filter.query}
                  onChange={handleFilterChange}
                  disabled={loading}
                  style={{
                    borderRadius: 12,
                    background: '#fff',
                    fontSize: 16,
                    padding: '12px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    border: 'none',
                  }}
                  className="hover-scale-input"
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Button
                variant="primary"
                className="w-100"
                style={{
                  borderRadius: 12,
                  fontWeight: 700,
                  padding: '12px 16px',
                  boxShadow: '0 4px 15px rgba(52,152,219,0.3)',
                  background: 'linear-gradient(90deg, #0d6efd 0%, #0a58ca 100%)',
                  transition: 'all 0.3s ease',
                }}
                onClick={handleFilterApply}
                disabled={loading}
                type="button"
              >
                Apply Filter
              </Button>
            </Col>
          </Row>
        </Form>
      </div>

      {/* Error */}
      {error && (
        <Alert
          variant="danger"
          className="mb-4"
          style={{
            borderRadius: 12,
            boxShadow: '0 4px 15px rgba(220,53,69,0.2)',
            animation: 'fadeInUp 0.5s ease-out',
          }}
        >
          {error}
        </Alert>
      )}

      {/* Data Table */}
      <div
        className="card shadow-lg border-0 mb-4 data-table-container"
        style={{
          borderRadius: 20,
          background: 'linear-gradient(135deg, #fff 0%, #fdfdfd 100%)',
          boxShadow: '0 10px 40px rgba(52,152,219,0.15)',
          overflow: 'hidden',
        }}
      >
        <div className="card-body p-0">
          <DataTable
            data={dateFilteredHistory}
            columns={columns}
            keyField="id"
            actions
            onEdit={handleEdit}
            onDelete={handleDelete}
            loading={loading}
          />
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        centered
        contentClassName="border-0"
        style={{ borderRadius: 20 }}
        backdropClassName="custom-backdrop"
      >
        <Modal.Header
          closeButton
          style={{
            borderBottom: 'none',
            background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: '1.5rem 2rem',
          }}
        >
          <Modal.Title
            style={{
              fontWeight: 800,
              color: '#27ae60',
              letterSpacing: 0.5,
              textShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            Edit History Entry
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditSubmit}>
          <Modal.Body
            style={{
              background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              padding: '2rem',
            }}
          >
            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Quantity</Form.Label>
              <Form.Control
                name="qty"
                type="number"
                value={editForm.qty}
                onChange={handleEditFormChange}
                required
                disabled={loading}
                style={{
                  borderRadius: 12,
                  background: '#fff',
                  fontSize: 16,
                  padding: '12px 16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  border: 'none',
                }}
                className="hover-scale-input"
              />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>Action</Form.Label>
              <Form.Control
                name="action"
                value={editForm.action}
                onChange={handleEditFormChange}
                required
                disabled={loading}
                style={{
                  borderRadius: 12,
                  background: '#fff',
                  fontSize: 16,
                  padding: '12px 16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  border: 'none',
                }}
                className="hover-scale-input"
              />
            </Form.Group>
            {columns
              .filter((col) => !['qty', 'action'].includes(col.field))
              .map((col) => (
                <Form.Group className="mb-4" key={col.field}>
                  <Form.Label style={{ fontWeight: 700, color: '#23272b' }}>{col.header}</Form.Label>
                  <Form.Control
                    type="text"
                    value={editEntry ? editEntry[col.field] : ''}
                    readOnly
                    style={{
                      borderRadius: 12,
                      background: '#f8fafd',
                      fontSize: 16,
                      padding: '12px 16px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      border: 'none',
                      color: '#888',
                    }}
                  />
                </Form.Group>
              ))}
          </Modal.Body>
          <Modal.Footer
            style={{
              borderTop: 'none',
              background: 'linear-gradient(135deg, #f8fafd 0%, #e9ecef 100%)',
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              padding: '1.5rem 2rem',
            }}
          >
            <Button
              variant="secondary"
              onClick={() => setShowEditModal(false)}
              disabled={loading}
              style={{
                borderRadius: 12,
                fontWeight: 700,
                padding: '12px 24px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
              }}
              className="hover-scale"
            >
              Cancel
            </Button>
            <Button
              variant="success"
              type="submit"
              disabled={loading}
              style={{
                borderRadius: 12,
                fontWeight: 700,
                padding: '12px 24px',
                boxShadow: '0 4px 15px rgba(25,135,84,0.3)',
                background: 'linear-gradient(90deg, #198754 0%, #0f5132 100%)',
                transition: 'all 0.3s ease',
              }}
              className="hover-scale"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default History;