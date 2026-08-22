// Panel de administración - CRUD de noticias
document.addEventListener('DOMContentLoaded', () => {
    cargarNoticias();
    
    document.getElementById('formNoticia').addEventListener('submit', guardarNoticia);
});

function cargarNoticias() {
    fetch('api.php?action=listar')
        .then(res => res.json())
        .then(data => {
            const tbody = document.querySelector('#tablaNoticias tbody');
            tbody.innerHTML = data.map(n => `
                <tr>
                    <td>${n.id}</td>
                    <td>${n.titulo}</td>
                    <td>${n.categoria}</td>
                    <td>
                        <button onclick="editar(${n.id})">✏️</button>
                        <button onclick="eliminar(${n.id})">🗑️</button>
                    </td>
                </tr>
            `).join('');
        });
}

function guardarNoticia(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    fetch('api.php?action=guardar', {
        method: 'POST',
        body: form
    }).then(() => cargarNoticias());
}
