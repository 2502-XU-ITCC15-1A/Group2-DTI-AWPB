export const getEntries = async (token) => {
  const res = await fetch('/api/entries', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return res.json();
};

export const deleteEntry = async (id, token) => {
  await fetch(`/api/entries/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
};

export const updateEntry = async (id, data, token) => {
  const res = await fetch(`/api/entries/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return res.json();
};