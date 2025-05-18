import React, { useState, useEffect, useCallback } from 'react';
import { useDebounce } from 'use-debounce';
import {
  getParkingSlots,
  createBulkParkingSlots,
  updateParkingSlot,
  deleteParkingSlot,
} from '../utils/api';
import Pagination from '../components/common/Pagination';

const ParkingSlots = () => {
  const [slots, setSlots] = useState([]);
  const [meta, setMeta] = useState({ totalItems: 0, currentPage: 1, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search.trim().replace(/\s+/g, ' '), 500);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bulkForm, setBulkForm] = useState({ count: '', location: '', size: '', vehicle_type: '' });
  const [editForm, setEditForm] = useState({ 
    slot_number: '', 
    location: '', 
    size: '', 
    vehicle_type: '', 
    status: '' 
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getParkingSlots(page, limit, debouncedSearch);
      setSlots(response.data.data);
      setMeta(response.data.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch parking slots');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleBulkInputChange = (e) => {
    const { name, value } = e.target;
    setBulkForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { count, location, size, vehicle_type } = bulkForm;
    
    // Sanitize and validate inputs
    const sanitizedCount = parseInt(count);
    const sanitizedLocation = location.trim();
    const sanitizedSize = size.trim().toLowerCase();
    const sanitizedVehicleType = vehicle_type.trim().toLowerCase();

    if (!sanitizedCount || !sanitizedLocation || !sanitizedSize || !sanitizedVehicleType) {
      setError('All fields are required');
      return;
    }
    
    if (isNaN(sanitizedCount)) {
      setError('Count must be a number');
      return;
    }
    
    if (sanitizedCount <= 0 || sanitizedCount > 100) {
      setError('Count must be between 1 and 100');
      return;
    }

    const validSizes = ['small', 'medium', 'large'];
    const validVehicleTypes = ['car', 'taxi', 'truck', 'any'];
    if (!validSizes.includes(sanitizedSize)) {
      setError(`Invalid size: ${sanitizedSize}. Must be one of ${validSizes.join(', ')}`);
      return;
    }
    if (!validVehicleTypes.includes(sanitizedVehicleType)) {
      setError(`Invalid vehicle type: ${sanitizedVehicleType}. Must be one of ${validVehicleTypes.join(', ')}`);
      return;
    }

    setIsCreating(true);
    
    try {
      // Generate unique slot numbers with prefix and sequence
      const prefix = `SLOT-${Math.floor(Math.random() * 1000)}`;
      const slots = Array.from({ length: sanitizedCount }, (_, i) => ({
        slot_number: `${prefix}-${i + 1}`,
        location: sanitizedLocation,
        size: sanitizedSize,
        vehicle_type: sanitizedVehicleType,
        status: 'available'
      }));

      await createBulkParkingSlots({ slots });
      
      setBulkForm({ count: '', location: '', size: '', vehicle_type: '' });
      setShowBulkModal(false);
      await fetchSlots();
      alert(`${sanitizedCount} parking slots created successfully!`);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create parking slots';
      setError(errorMsg);
      console.error('Creation error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { slot_number, location, size, vehicle_type, status } = editForm;
    
    // Sanitize and validate inputs
    const sanitizedSlotNumber = slot_number.trim();
    const sanitizedLocation = location.trim();
    const sanitizedSize = size.trim().toLowerCase();
    const sanitizedVehicleType = vehicle_type.trim().toLowerCase();
    const sanitizedStatus = status.trim().toLowerCase();

    const validSizes = ['small', 'medium', 'large'];
    const validVehicleTypes = ['car', 'taxi', 'truck', 'any'];
    const validStatuses = ['available', 'unavailable'];

    if (!sanitizedSlotNumber || !sanitizedLocation || !sanitizedSize || !sanitizedVehicleType || !sanitizedStatus) {
      setError('All fields are required');
      return;
    }
    if (!validSizes.includes(sanitizedSize)) {
      setError(`Invalid size: ${sanitizedSize}. Must be one of ${validSizes.join(', ')}`);
      return;
    }
    if (!validVehicleTypes.includes(sanitizedVehicleType)) {
      setError(`Invalid vehicle type: ${sanitizedVehicleType}. Must be one of ${validVehicleTypes.join(', ')}`);
      return;
    }
    if (!validStatuses.includes(sanitizedStatus)) {
      setError(`Invalid status: ${sanitizedStatus}. Must be one of ${validStatuses.join(', ')}`);
      return;
    }

    try {
      await updateParkingSlot(editId, { 
        slot_number: sanitizedSlotNumber, 
        location: sanitizedLocation, 
        size: sanitizedSize, 
        vehicle_type: sanitizedVehicleType, 
        status: sanitizedStatus 
      });
      
      setEditForm({ 
        slot_number: '', 
        location: '', 
        size: '', 
        vehicle_type: '', 
        status: '' 
      });
      setIsEditing(false);
      setEditId(null);
      await fetchSlots();
      alert('Parking slot updated successfully!');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update parking slot';
      setError(errorMsg);
      console.error('Update error:', err);
    }
  };

  const handleEdit = (slot) => {
    setEditForm({
      slot_number: slot.slot_number,
      location: slot.location,
      size: slot.size,
      vehicle_type: slot.vehicle_type,
      status: slot.status,
    });
    setEditId(slot.id);
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this parking slot?')) {
      return;
    }

    try {
      await deleteParkingSlot(id);
      await fetchSlots();
      alert('Parking slot deleted successfully!');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to delete parking slot';
      setError(errorMsg);
      console.error('Deletion error:', err);
    }
  };

  return (
    <div className="container mx-auto p-6 bg-accent min-h-screen">
      <h1 className="text-3xl font-bold text-primary mb-6">Parking Slots</h1>
      
      <div className="mb-4 flex justify-between items-center">
        <input
          type="text"
          placeholder="Search by slot number, vehicle type, or location"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full sm:w-1/2"
        />
        <button
          onClick={() => setShowBulkModal(true)}
          className="btn-primary"
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Bulk Slots'}
        </button>
      </div>

      {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
        <p>{error}</p>
      </div>}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-10 w-10 border-4 border-secondary border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-primary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Slot Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Vehicle Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {slots.length > 0 ? (
                  slots.map((slot) => (
                    <tr key={slot.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{slot.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{slot.slot_number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{slot.location}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{slot.size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{slot.vehicle_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${slot.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {slot.status === 'available' ? 'Available' : 'Occupied'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(slot)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(slot.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                      No parking slots found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <Pagination meta={meta} setPage={setPage} />
        </>
      )}

      {/* Bulk Create Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold text-primary mb-4">Create Bulk Parking Slots</h2>
            
            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              <p>{error}</p>
            </div>}
            
            <form onSubmit={handleBulkSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="count">
                  Number of Slots (1-100)
                </label>
                <input
                  type="number"
                  id="count"
                  name="count"
                  value={bulkForm.count}
                  onChange={handleBulkInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  min="1"
                  max="100"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="location">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={bulkForm.location}
                  onChange={handleBulkInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="size">
                  Size
                </label>
                <select
                  id="size"
                  name="size"
                  value={bulkForm.size}
                  onChange={handleBulkInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                >
                  <option value="">Select Size</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="vehicle_type">
                  Vehicle Type
                </label>
                <select
                  id="vehicle_type"
                  name="vehicle_type"
                  value={bulkForm.vehicle_type}
                  onChange={handleBulkInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                >
                  <option value="">Select Vehicle Type</option>
                  <option value="car">Car</option>
                  <option value="taxi">Taxi</option>
                  <option value="truck">Truck</option>
                  <option value="any">Any</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkModal(false);
                    setError('');
                  }}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Slots'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold text-primary mb-4">Edit Parking Slot</h2>
            
            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              <p>{error}</p>
            </div>}
            
            <form onSubmit={handleEditSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="edit-slot_number">
                  Slot Number
                </label>
                <input
                  type="text"
                  id="edit-slot_number"
                  name="slot_number"
                  value={editForm.slot_number}
                  onChange={handleEditInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="edit-location">
                  Location
                </label>
                <input
                  type="text"
                  id="edit-location"
                  name="location"
                  value={editForm.location}
                  onChange={handleEditInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="edit-size">
                  Size
                </label>
                <select
                  id="edit-size"
                  name="size"
                  value={editForm.size}
                  onChange={handleEditInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                >
                  <option value="">Select Size</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="edit-vehicle_type">
                  Vehicle Type
                </label>
                <select
                  id="edit-vehicle_type"
                  name="vehicle_type"
                  value={editForm.vehicle_type}
                  onChange={handleEditInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                >
                  <option value="">Select Vehicle Type</option>
                  <option value="car">Car</option>
                  <option value="taxi">Taxi</option>
                  <option value="truck">Truck</option>
                  <option value="any">Any</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-900 text-sm font-bold mb-2" htmlFor="edit-status">
                  Status
                </label>
                <select
                  id="edit-status"
                  name="status"
                  value={editForm.status}
                  onChange={handleEditInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline"
                  required
                >
                  <option value="">Select Status</option>
                  <option value="available">Available</option>
                  <option value="unavailable">Occupied</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditId(null);
                    setError('');
                  }}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Update Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingSlots;