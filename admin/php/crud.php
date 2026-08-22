<?php
include 'config.php';

$action = $_GET['action'] ?? '';

switch($action) {
    case 'listar':
        $result = $conn->query("SELECT * FROM noticias ORDER BY id DESC");
        echo json_encode($result->fetch_all(MYSQLI_ASSOC));
        break;
        
    case 'guardar':
        $titulo = $_POST['titulo'];
        $contenido = $_POST['contenido'];
        $conn->query("INSERT INTO noticias (titulo, contenido) VALUES ('$titulo', '$contenido')");
        break;
        
    case 'eliminar':
        $id = $_GET['id'];
        $conn->query("DELETE FROM noticias WHERE id=$id");
        break;
}
?>
