import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { FileText, Search, X } from 'lucide-react';

export default function ShiftHistoryModal({ onClose }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    API.get('/shifts')
      .then((res) => setShifts(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredShifts = shifts.filter((s) => 
    s.cashier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.cashier?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="modal-backdrop">
      <div className="modal modal-shift modal-audit-container">
        {/* Modal Header */}
        <div className="modal-top-header">
          <div className="modal-title-group">
            <FileText size={20} className="modal-header-icon" />
            <h3>Register Shift Audit & Z-Reports</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="icon-btn modal-close-btn" 
            aria-label="Close Modal"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {selectedShift ? (
          /* Detailed View */
          <div className="z-report-view">
            <button 
              type="button" 
              onClick={() => setSelectedShift(null)} 
              className="btn-link-sm back-link"
            >
              ← Back to Shift List
            </button>

            <div className="z-report-header">
              <FileText size={28} />
              <h2>Z-REPORT AUDIT</h2>
              <small>Cashier: <strong>{selectedShift.cashier?.name}</strong> ({selectedShift.cashier?.email})</small>
              <small>Closed: {selectedShift.closedAt ? new Date(selectedShift.closedAt).toLocaleString() : 'N/A'}</small>
            </div>

            <div className="z-report-details">
              <div className="z-row"><span>Starting Float:</span><span>PKR {selectedShift.startingFloat?.toFixed(2)}</span></div>
              <div className="z-row"><span>Cash Sales:</span><span>PKR {selectedShift.cashSales?.toFixed(2)}</span></div>
              <div className="z-row"><span>Card Sales:</span><span>PKR {selectedShift.cardSales?.toFixed(2)}</span></div>
              <hr className="z-divider" />
              <div className="z-row highlight"><span>Expected Cash:</span><span>PKR {selectedShift.expectedCash?.toFixed(2)}</span></div>
              <div className="z-row highlight"><span>Actual Cash Counted:</span><span>PKR {selectedShift.actualCashCounted?.toFixed(2)}</span></div>
              <hr className="z-divider" />
              <div className={`z-row variance ${selectedShift.difference >= 0 ? 'over' : 'short'}`}>
                <span>Variance (Over/Short):</span>
                <span>{selectedShift.difference >= 0 ? `+${selectedShift.difference?.toFixed(2)}` : selectedShift.difference?.toFixed(2)} PKR</span>
              </div>
              {selectedShift.notes && (
                <div className="z-notes">
                  <strong>Notes:</strong> {selectedShift.notes}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Shift List Table View */
          <>
            <div className="search-box search-box-block">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by cashier name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="table-responsive table-scroll-md">
              {loading ? (
                <p className="empty-state">Loading shift audit history...</p>
              ) : filteredShifts.length === 0 ? (
                <p className="empty-state">No register shift reports found.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cashier</th>
                      <th>Closed At</th>
                      <th>Expected</th>
                      <th>Counted</th>
                      <th>Variance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShifts.map((shift) => (
                      <tr key={shift._id}>
                        <td>
                          <strong>{shift.cashier?.name || 'Unknown'}</strong>
                          <br />
                          <small className="muted">{shift.cashier?.email}</small>
                        </td>
                        <td>{shift.closedAt ? new Date(shift.closedAt).toLocaleDateString() : 'OPEN'}</td>
                        <td>PKR {shift.expectedCash?.toFixed(2)}</td>
                        <td>PKR {shift.actualCashCounted?.toFixed(2)}</td>
                        <td>
                          <span className={`badge ${shift.difference < 0 ? 'warning' : 'success'}`}>
                            {shift.difference >= 0 ? `+${shift.difference?.toFixed(2)}` : `${shift.difference?.toFixed(2)}`}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedShift(shift)}
                            className="btn-secondary" btn-sm
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}