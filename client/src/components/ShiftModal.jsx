import React, { useState } from 'react';
import { isAdminUser } from '../utils/roles';
import API from '../services/api';
import { FileText, Clock } from 'lucide-react';
import ShiftHistoryModal from './ShiftHistoryModal';

export default function ShiftModal({ activeShift, onShiftUpdated, onClose, user }) {
  const [startingFloat, setStartingFloat] = useState(5000);
  const [actualCash, setActualCash] = useState(0);
  const [notes, setNotes] = useState('');
  const [zReport, setZReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/shifts/open', { startingFloat: Number(startingFloat) });
      onShiftUpdated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to open shift');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/shifts/close', {
        actualCashCounted: Number(actualCash),
        notes
      });
      setZReport(res.data.zReport);
      onShiftUpdated(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to close shift');
    } finally {
      setLoading(false);
    }
  };

  // Switch to full Shift History Audit modal view if requested
  if (showHistoryModal) {
    return <ShiftHistoryModal onClose={() => setShowHistoryModal(false)} />;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal-shift">
        {/* CASE 1: Start Shift Form */}
        {!activeShift && !zReport && (
          <form onSubmit={handleOpenShift} className="modal-form">
            <h2><Clock size={20} /> Open Register Shift</h2>
            <p className="modal-subtitle">Enter starting cash float in drawer to begin sales.</p>
            {error && <div className="error-alert">{error}</div>}
            
            <div className="form-group">
              <label>Starting Float Amount (PKR)</label>
              <input
                type="number"
                value={startingFloat}
                onChange={(e) => setStartingFloat(e.target.value)}
                required
                min="0"
              />
            </div>

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Opening...' : 'Start Shift'}
              </button>
            </div>
          </form>
        )}

        {/* CASE 2: Close Shift Form */}
        {activeShift && !zReport && (
          <form onSubmit={handleCloseShift} className="modal-form">
            <h2><Clock size={20} /> Close Shift & Z-Report</h2>
            <p className="modal-subtitle">Count physical cash in drawer to generate report.</p>
            {error && <div className="error-alert">{error}</div>}

            <div className="shift-summary-box">
              <div>Opened: <strong>{new Date(activeShift.openedAt).toLocaleTimeString()}</strong></div>
              <div>Starting Float: <strong>PKR {activeShift.startingFloat}</strong></div>
            </div>

            <div className="form-group">
              <label>Actual Cash Counted in Drawer (PKR)</label>
              <input
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                required
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Shift notes..."
                rows="2"
              />
            </div>

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={loading} className="btn-danger">
                {loading ? 'Closing...' : 'Close & Generate Z-Report'}
              </button>
            </div>
          </form>
        )}

        {/* CASE 3: Z-Report Summary View */}
        {zReport && (
          <div className="z-report-view">
            <div className="z-report-header">
              <FileText size={32} />
              <h2>Z-REPORT SUMMARY</h2>
              <small>Cashier: <strong>{zReport.cashier?.name || 'Current User'}</strong></small>
              <small>Closed: {new Date(zReport.closedAt).toLocaleString()}</small>
            </div>

            <div className="z-report-details">
              <div className="z-row"><span>Starting Float:</span><span>PKR {zReport.startingFloat.toFixed(2)}</span></div>
              <div className="z-row"><span>Cash Sales:</span><span>PKR {zReport.cashSales.toFixed(2)}</span></div>
              <div className="z-row"><span>Card/Digital Sales:</span><span>PKR {zReport.cardSales.toFixed(2)}</span></div>
              <hr className="z-divider" />
              <div className="z-row highlight"><span>Expected Cash:</span><span>PKR {zReport.expectedCash.toFixed(2)}</span></div>
              <div className="z-row highlight"><span>Actual Cash Counted:</span><span>PKR {zReport.actualCashCounted.toFixed(2)}</span></div>
              <hr className="z-divider" />
              <div className={`z-row variance ${zReport.difference >= 0 ? 'over' : 'short'}`}>
                <span>Variance (Over/Short):</span>
                <span>{zReport.difference >= 0 ? `+${zReport.difference.toFixed(2)}` : zReport.difference.toFixed(2)} PKR</span>
              </div>
            </div>

            <button onClick={onClose} className="btn-primary" btn-block>
              Done
            </button>
          </div>
        )}

        {/* Admin Audit Link */}
        {isAdminUser(user) && (
          <button 
            type="button" 
            onClick={() => setShowHistoryModal(true)} 
            className="btn-link-sm"
          >
            <FileText size={15} /> View Past Z-Reports & Cashier Audits
          </button>
        )}
      </div>
    </div>
  );
}