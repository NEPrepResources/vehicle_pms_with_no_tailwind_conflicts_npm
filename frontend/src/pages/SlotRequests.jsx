import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import { getSlotRequests, approveRequest, rejectRequest } from '../utils/api';
import Pagination from '../components/common/Pagination';

const SlotRequests = () => {
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState({ totalItems: 0, currentPage: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search.trim().replace(/\s+/g, ' '), 500);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getSlotRequests(page, limit, debouncedSearch);
      setRequests(response.data.data);
      setMeta(response.data.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch requests');
    }
    setLoading(false);
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (id) => {
    try {
      const response = await approveRequest(id);
      alert(`Request approved. Slot: ${response.data.slot?.slot_number || 'N/A'}. Email: ${response.data.emailStatus}`);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve request');
    }
  };

  const handleReject = async () => {
    const sanitizedReason = rejectReason.trim();
    if (!sanitizedReason) {
      alert('Please provide a reason for rejection');
      return;
    }
    try {
      const response = await rejectRequest(selectedRequestId, sanitizedReason);
      alert(`Request rejected. Email: ${response.data.emailStatus}`);
      setRejectReason('');
      setSelectedRequestId(null);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject request');
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = 'px-3 py-1 rounded-full text-sm font-medium';
    
    switch (status.toLowerCase()) {
      case 'approved':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Approved</span>;
      case 'rejected':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Rejected</span>;
      case 'pending':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Pending</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
    }
  };

  const handleViewDetails = (request) => {
    setSelectedRequestDetails(request);
  };

  const closeDetailsModal = () => {
    setSelectedRequestDetails(null);
  };

  return (
    <div className="container mx-auto p-6 bg-accent min-h-screen">
      <h1 className="text-3xl font-bold text-primary mb-6">Slot Requests</h1>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by plate number or status"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full sm:w-1/2"
        />
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <div className="flex justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-primary text-white">
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">Plate Number</th>
                <th className="p-3 text-left">Vehicle Type</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b hover:bg-accent">
                  <td className="p-3">{req.id}</td>
                  <td className="p-3">{req.plate_number}</td>
                  <td className="p-3 capitalize">{req.vehicle_type}</td>
                  <td className="p-3">{getStatusBadge(req.request_status)}</td>
                  <td className="p-3">
                    {req.request_status.toLowerCase() === 'pending' ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="btn-primary px-3 py-1"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setSelectedRequestId(req.id)}
                          className="btn-danger px-3 py-1"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleViewDetails(req)}
                        className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                      >
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Request Modal */}
      {selectedRequestId && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold text-primary mb-4">
              Reject Request #{selectedRequestId}
            </h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection"
              className="input mb-4"
              rows="4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setRejectReason('');
                  setSelectedRequestId(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleReject} className="btn-danger">
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedRequestDetails && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold text-primary mb-4">
              Request Details #{selectedRequestDetails.id}
            </h2>
            <div className="space-y-3">
              <div>
                <p className="font-semibold">Plate Number:</p>
                <p>{selectedRequestDetails.plate_number}</p>
              </div>
              <div>
                <p className="font-semibold">Vehicle Type:</p>
                <p className="capitalize">{selectedRequestDetails.vehicle_type}</p>
              </div>
              <div>
                <p className="font-semibold">Status:</p>
                {getStatusBadge(selectedRequestDetails.request_status)}
              </div>
              {selectedRequestDetails.request_status.toLowerCase() === 'rejected' && selectedRequestDetails.rejection_reason && (
                <div>
                  <p className="font-semibold">Rejection Reason:</p>
                  <p>{selectedRequestDetails.rejection_reason}</p>
                </div>
              )}
              {selectedRequestDetails.request_status.toLowerCase() === 'approved' && selectedRequestDetails.slot && (
                <div>
                  <p className="font-semibold">Assigned Slot:</p>
                  <p>{selectedRequestDetails.slot.slot_number}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={closeDetailsModal}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Pagination meta={meta} setPage={setPage} />
    </div>
  );
};

export default SlotRequests;