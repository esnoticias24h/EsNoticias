<?php
session_start();
if ($_POST) {
    if ($_POST['user'] == 'admin' && $_POST['pass'] == '1234') {
        $_SESSION['admin'] = true;
        header('Location: index.html');
        exit;
    } else {
        $error = "Credenciales incorrectas";
    }
}
?>
<!DOCTYPE html>
<html>
<head><title>Login Admin</title></head>
<body>
    <form method="POST">
        <h2>🔐 Acceso Panel</h2>
        <?php if (isset($error)) echo "<p style='color:red'>$error</p>"; ?>
        <input type="text" name="user" placeholder="Usuario" required><br>
        <input type="password" name="pass" placeholder="Contraseña" required><br>
        <button type="submit">Entrar</button>
    </form>
</body>
</html>
