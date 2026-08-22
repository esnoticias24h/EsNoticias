<?php
header('Content-Type: application/json');

// Conexión a la base de datos
include 'admin/php/config.php'; // ← Asegúrate de que esta ruta exista

$termino = $_GET['q'] ?? '';
$termino = $conn->real_escape_string($termino);

if (strlen($termino) < 2) {
    echo json_encode([]);
    exit;
}

$sql = "SELECT * FROM noticias 
        WHERE titulo LIKE '%$termino%' 
        OR contenido LIKE '%$termino%' 
        OR categoria LIKE '%$termino%'
        ORDER BY fecha DESC 
        LIMIT 20";

$result = $conn->query($sql);
$noticias = $result->fetch_all(MYSQLI_ASSOC);

echo json_encode($noticias);
?>
