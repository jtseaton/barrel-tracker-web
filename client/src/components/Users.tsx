import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User } from '../types/interfaces';
import { Role } from '../types/enums';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Get current user from localStorage (simplified)
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = [Role.SuperAdmin, Role.Admin].includes(currentUser.role);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      console.error('Fetch users error:', err);
      setError('Failed to fetch users: ' + err.message);
    }
  };

  const handleAddUser = () => {
    if (!isAdmin) {
      setError('Only Super Admin or Admin can add users');
      return;
    }
    navigate('/users/new');
  };

  const handleDeleteUsers = async () => {
    if (!isAdmin) {
      setError('Only Super Admin or Admin can delete users');
      return;
    }
    if (selectedUsers.length === 0) {
      setError('No users selected to delete');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: selectedUsers }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setSelectedUsers([]);
      fetchUsers();
      setError(null);
    } catch (err: any) {
      console.error('Delete users error:', err);
      setError('Failed to delete users: ' + err.message);
    }
  };

  const handleToggleEnable = async (enable: boolean) => {
    if (!isAdmin) {
      setError('Only Super Admin or Admin can enable/disable users');
      return;
    }
    if (selectedUsers.length === 0) {
      setError('No users selected to enable/disable');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: selectedUsers, enabled: enable }),
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setSelectedUsers([]);
      fetchUsers();
      setError(null);
    } catch (err: any) {
      console.error('Toggle enable error:', err);
      setError(`Failed to ${enable ? 'enable' : 'disable'} users: ` + err.message);
    }
  };

  const handleCheckboxChange = (email: string) => {
    setSelectedUsers((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: '100vh' }}>
      <h2 style={{ color: '#EEC930', fontSize: '24px', marginBottom: '20px', textAlign: 'center' }}>Users List</h2>
      {error && <div className="error">{error}</div>}
      <div className="inventory-actions">
        <button onClick={handleAddUser} disabled={!isAdmin}>Add User</button>
        <button onClick={handleDeleteUsers} disabled={!isAdmin || selectedUsers.length === 0}>Delete User</button>
        <button onClick={() => handleToggleEnable(false)} disabled={!isAdmin || selectedUsers.length === 0}>Disable User</button>
      </div>
      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.email}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.email)}
                    onChange={() => handleCheckboxChange(user.email)}
                    disabled={!isAdmin}
                  />
                </td>
                <td>
                  <Link to={`/users/${user.email}`}>{user.email}</Link>
                </td>
                <td>{user.role}</td>
                <td>{user.enabled ? 'Enabled' : 'Disabled'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;