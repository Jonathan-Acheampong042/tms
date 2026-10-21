const loginForm = document.querySelector('#login-form');

if (loginForm) {
  const message = document.querySelector('#login-message');
  const submitButton = loginForm.querySelector('button[type="submit"]');

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    submitButton.disabled = true;

    const formData = new FormData(loginForm);
    try {
      const user = await apiFetch('/auth/login', {
        method: 'POST',
        body: {
          identifier: formData.get('identifier'),
          password: formData.get('password'),
        },
      });
      const destinations = {
        customer: 'customer-dashboard.html',
        driver: 'driver-dashboard.html',
        admin: 'admin-dashboard.html',
      };
      const destination = destinations[user?.role];
      if (!destination || typeof user.id !== 'string') {
        throw new Error('The account has an unrecognized role. Contact an administrator.');
      }
      sessionStorage.setItem('tms.currentUser', JSON.stringify(user));
      window.location.href = destination;
    } catch (error) {
      message.textContent = error.message;
      submitButton.disabled = false;
    }
  });
}

const signupForm = document.querySelector('#signup-form');

if (signupForm) {
  const message = document.querySelector('#signup-message');
  const submitButton = signupForm.querySelector('button[type="submit"]');
  const roleSelect = signupForm.querySelector('[name="role"]');
  const driverFields = signupForm.querySelector('#driver-fields');
  const driverInputs = driverFields.querySelectorAll('input');

  function updateRoleFields() {
    const isDriver = roleSelect.value === 'driver';
    driverFields.hidden = !isDriver;
    for (const input of driverInputs) {
      input.required = isDriver;
      if (!isDriver) input.value = '';
    }
  }

  roleSelect.addEventListener('change', updateRoleFields);
  updateRoleFields();

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    message.dataset.state = '';
    submitButton.disabled = true;

    const formData = new FormData(signupForm);
    const body = Object.fromEntries(formData.entries());
    for (const optionalField of [
      'middle_name',
      'phone',
      'address',
      'license_number',
      'license_expiry',
    ]) {
      body[optionalField] = body[optionalField]?.trim() || null;
    }

    try {
      await apiFetch('/users', { method: 'POST', body });
      signupForm.reset();
      updateRoleFields();
      message.dataset.state = 'success';
      message.textContent = 'Your account has been created. You can now sign in.';
      submitButton.textContent = 'Account created';
    } catch (error) {
      message.textContent = error.message;
      submitButton.disabled = false;
    }
  });
}
