document.addEventListener('DOMContentLoaded', function () {
  const temas = ['azul', 'vermelho', 'verde'];
  const temaSalvo = localStorage.getItem('tema') || 'azul';
  document.documentElement.setAttribute('data-tema', temaSalvo);

  const form = document.getElementById('form-login');
  const erro = document.getElementById('erro-login');

  api('/api/auth/me')
    .then(function () { window.location.href = '/app.html'; })
    .catch(function () {});

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    erro.classList.add('hidden');
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: {
          email: document.getElementById('inp-email').value,
          senha: document.getElementById('inp-senha').value
        }
      });
      window.location.href = '/app.html';
    } catch (e) {
      erro.textContent = e.message;
      erro.classList.remove('hidden');
    }
  });

  document.getElementById('btn-login-info').addEventListener('click', function () {
    document.getElementById('modal-info').classList.remove('hidden');
  });
  document.getElementById('btn-info-fechar').addEventListener('click', function () {
    document.getElementById('modal-info').classList.add('hidden');
  });
});
