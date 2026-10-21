const userTableBody = document.querySelector('#user-table tbody');
const userListStatus = document.querySelector('#user-list-status');
const userLoadError = document.querySelector('#user-load-error');
const userDialog = document.querySelector('#user-dialog');
const userDialogForm = document.querySelector('#user-dialog-form');
const userDialogMessage = document.querySelector('#user-dialog-message');
const userDialogTitle = document.querySelector('#user-dialog-title');
const userDialogEyebrow = document.querySelector('#user-dialog-eyebrow');
const userDialogEdit = document.querySelector('#user-dialog-edit');
const userDialogSave = document.querySelector('#user-dialog-save');
const userRoleField = document.querySelector('#user-role');
const editableFields = ['first_name', 'middle_name', 'last_name', 'phone', 'address', 'role'];
const dialogFields = {
  username: document.querySelector('#user-username'),
  email: document.querySelector('#user-email'),
  is_active: document.querySelector('#user-status'),
  created_at: document.querySelector('#user-created'),
  first_name: document.querySelector('#edit-first-name'),
  middle_name: document.querySelector('#edit-middle-name'),
  last_name: document.querySelector('#edit-last-name'),
  phone: document.querySelector('#edit-phone'),
  address: document.querySelector('#edit-address'),
  role: document.querySelector('#user-role'),
};

let users = [];
let selectedUser;

function displayValue(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function formatUserName(user) {
  return [user.first_name, user.middle_name, user.last_name]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ') || 'Name not provided';
}

function formatCreatedAt(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function setDialogMode(isEditing) {
  for (const [name, input] of Object.entries(dialogFields)) {
    input.readOnly = !isEditing || !editableFields.includes(name);
  }

  userDialogTitle.textContent = isEditing ? 'Edit user details' : 'User account';
  userDialogEyebrow.textContent = isEditing ? 'EDIT PROFILE' : 'USER DETAILS';
  userDialogEdit.hidden = isEditing;
  userDialogSave.hidden = !isEditing;
  userDialogSave.disabled = false;
  userDialogMessage.textContent = '';
  userDialogMessage.dataset.state = '';
}

function openUserDialog(user, isEditing) {
  selectedUser = user;
  userRoleField.value = user.role;
  dialogFields.username.value = displayValue(user.username);
  dialogFields.email.value = displayValue(user.email);
  dialogFields.is_active.value = user.is_active ? 'Active' : 'Inactive';
  dialogFields.created_at.value = formatCreatedAt(user.created_at);

  for (const field of editableFields) {
    dialogFields[field].value = user[field] ?? '';
  }

  setDialogMode(isEditing);
  userDialog.showModal();
  if (isEditing) dialogFields.first_name.focus();
  else userDialog.querySelector('#user-dialog-cancel').focus();
}

function createActionButton(label, user, isEditing) {
  const button = document.createElement('button');
  button.className = isEditing ? 'button' : 'button button-secondary';
  button.type = 'button';
  button.textContent = label;
  button.setAttribute('aria-label', `${label} ${formatUserName(user)}`);
  button.addEventListener('click', () => openUserDialog(user, isEditing));
  return button;
}

function renderUsers() {
  userTableBody.replaceChildren();

  if (users.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'workspace-empty';
    cell.textContent = 'No user accounts were found.';
    row.append(cell);
    userTableBody.append(row);
    return;
  }

  users.forEach((user) => {
    const row = document.createElement('tr');
    const values = [
      formatUserName(user),
      displayValue(user.username),
      displayValue(user.email),
      displayValue(user.role),
      user.is_active ? 'Active' : 'Inactive',
    ];

    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }

    const actionCell = document.createElement('td');
    actionCell.className = 'user-table-actions';
    actionCell.append(
      createActionButton('View', user, false),
      createActionButton('Edit', user, true),
    );
    row.append(actionCell);
    userTableBody.append(row);
  });
}

function showSkeletonLoaders() {
  userTableBody.replaceChildren();
  for (let i = 0; i < 5; i++) {
    const row = document.createElement('tr');
    row.className = 'skeleton-row';
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.innerHTML = '<div class="skeleton-loader"></div>';
    row.append(cell);
    userTableBody.append(row);
  }
}

async function loadUsers() {
  showSkeletonLoaders();
  userListStatus.textContent = 'Loading user records…';
  userLoadError.textContent = '';

  try {
    const response = await apiFetch('/users');
    if (!Array.isArray(response) || response.some((user) => !user || typeof user !== 'object' || typeof user.id !== 'string')) {
      throw new Error('The user-list endpoint returned an invalid response.');
    }

    users = response;
    renderUsers();
    userListStatus.textContent = `${users.length} ${users.length === 1 ? 'account' : 'accounts'}`;
  } catch (error) {
    console.error('Could not load user accounts:', error);
    renderUsers(); // Will show empty state
    userListStatus.textContent = 'User accounts unavailable';
    userLoadError.textContent = error.message || 'Could not load user accounts.';
  }
}

userDialogEdit.addEventListener('click', () => setDialogMode(true));
document.querySelector('#user-dialog-cancel').addEventListener('click', () => userDialog.close());
document.querySelector('#user-dialog-close').addEventListener('click', () => userDialog.close());
userDialog.addEventListener('click', (event) => {
  if (event.target === userDialog) userDialog.close();
});

userDialogForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedUser || userDialogSave.hidden) return;

  userDialogSave.disabled = true;
  userDialogMessage.textContent = '';

  const formData = new FormData(userDialogForm);
  const profile = Object.fromEntries(
    ['first_name', 'middle_name', 'last_name', 'phone', 'address', 'role'].map((field) => [
      field,
      formData.get(field)?.trim() || null,
    ])
  );

  try {
    const updatedUser = await apiFetch(`/users/${encodeURIComponent(selectedUser.id)}/profile`, {
      method: 'PUT',
      body: profile,
    });
    if (!updatedUser || updatedUser.id !== selectedUser.id) {
      throw new Error('The updated user response did not match the selected account.');
    }

    users = users.map((user) => user.id === updatedUser.id ? updatedUser : user);
    renderUsers();
    selectedUser = updatedUser;
    userListStatus.textContent = `Saved changes for ${formatUserName(updatedUser)}.`;
    setDialogMode(false);
    for (const field of ['first_name', 'middle_name', 'last_name', 'phone', 'address', 'role']) {
      dialogFields[field].value = updatedUser[field] ?? '';
    }
    userDialog.close();
  } catch (error) {
    console.error('Could not update user profile:', error);
    userDialogMessage.textContent = error.message || 'Could not update the user profile.';
    userDialogSave.disabled = false;
  }
});

loadUsers();
