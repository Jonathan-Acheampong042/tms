const profileForm = document.querySelector('#profile-form');

if (profileForm) {
  const profileMessage = document.querySelector('#profile-message');
  const saveButton = profileForm.querySelector('button[type="submit"]');
  const fields = ['first_name', 'middle_name', 'last_name', 'phone', 'address', 'username', 'email'];
  let user;

  try {
    user = JSON.parse(sessionStorage.getItem('tms.currentUser'));
  } catch (error) {
    console.error('Could not read the signed-in user:', error);
    profileMessage.textContent = 'Could not read the current account. Please sign in again.';
  }

  function fillProfile(profile) {
    for (const field of fields) {
      const input = profileForm.elements.namedItem(field);
      input.value = profile[field] ?? '';
    }
  }

  async function loadProfile() {
    if (!user?.id) {
      profileMessage.textContent = 'No signed-in account was found. Please sign in again.';
      window.location.replace('login.html');
      return;
    }

    try {
      const profile = await apiFetch(`/users/${encodeURIComponent(user.id)}`);
      if (!profile || profile.id !== user.id) {
        throw new Error('The profile response did not match the signed-in account.');
      }
      fillProfile(profile);
      profileMessage.textContent = '';
      saveButton.disabled = false;
    } catch (error) {
      console.error('Could not load profile:', error);
      profileMessage.textContent = error.message || 'Could not load your profile.';
    }
  }

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    profileMessage.textContent = '';
    saveButton.disabled = true;
    const formData = new FormData(profileForm);
    const body = Object.fromEntries(
      ['first_name', 'middle_name', 'last_name', 'phone', 'address'].map((field) => [
        field,
        formData.get(field)?.trim() || null,
      ])
    );

    try {
      const profile = await apiFetch(`/users/${encodeURIComponent(user.id)}/profile`, {
        method: 'PUT',
        body,
      });
      if (!profile || profile.id !== user.id) {
        throw new Error('The saved profile response did not match the signed-in account.');
      }
      fillProfile(profile);
      sessionStorage.setItem('tms.currentUser', JSON.stringify({ ...user, ...profile }));
      profileMessage.dataset.state = 'success';
      profileMessage.textContent = 'Your profile has been updated.';
    } catch (error) {
      profileMessage.dataset.state = '';
      profileMessage.textContent = error.message || 'Could not save your profile.';
    } finally {
      saveButton.disabled = false;
    }
  });

  loadProfile();
}
