export default function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg bg-light">
      <div className="container">

        {/* Logo */}
        <a className="navbar-brand fw-bold" href="https://hubox.com/">
          <img
            src="/assets/img/logo-header.png"
            alt="HuBOX Logo"
            className="img-fluid"
            style={{ maxHeight: 60 }}
          />
        </a>

        {/* Botón mobile */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#menu"
          aria-controls="menu"
          aria-expanded="false"
          aria-label="Abrir menú"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Menú */}
        <div className="collapse navbar-collapse" id="menu">
          <ul className="navbar-nav ms-auto text-center">

            <li className="nav-item dropdown">
              <a className="nav-link dropdown-toggle" role="button" data-bs-toggle="dropdown">
                Nosotros{" "}
              </a>
              <ul className="dropdown-menu text-center text-lg-start">
                <li><a className="dropdown-item" href="https://hubox.com/nosotros.html#NM">Nuestra Misión</a></li>
                <hr style={{ margin: 5 }} />
                <li><a className="dropdown-item" href="https://hubox.com/nosotros.html#politicas">Políticas de Gestión</a></li>
                <hr style={{ margin: 5 }} />
                <li><a className="dropdown-item" href="https://hubox.com/transparencia.html">Transparencia</a></li>
                <hr style={{ margin: 5 }} />
                <li><a className="dropdown-item" href="https://hubox.com/aviso_privacidad.html">Aviso de Privacidad</a></li>
              </ul>
            </li>

            <li className="nav-item dropdown">
              <a className="nav-link dropdown-toggle" role="button" data-bs-toggle="dropdown">
                Ecosistema {" "}
              </a>
              <ul className="dropdown-menu text-center text-lg-start">
                <li><a className="dropdown-item" href="https://hubox.com/productos.html#ECO">Productos</a></li>
                <hr style={{ margin: 5 }} />
                <li><a className="dropdown-item" href="https://hubox.com/productos.html#SEV">Servicios</a></li>
              </ul>
            </li>

            <li className="nav-item">
              <a className="nav-link" href="https://hubox.com/#VAL">Valida INE</a>
            </li>

            <li className="nav-item">
              <a className="nav-link" href="https://hubox.com/#CO">
                Contacto
              </a>
            </li>

          </ul>
        </div>
      </div>
    </nav>
  )
}
