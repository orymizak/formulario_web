export default function Topbar() {
  return (
    <header className="topbar text-white py-2 d-none d-lg-block">
      <div className="container">
        <div className="d-flex flex-column flex-md-row align-items-center justify-content-between gap-2 gap-md-3 text-center text-md-start">
          <div className="contacts d-flex flex-column flex-md-row align-items-center justify-content-center justify-content-md-start gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-phone fs-5"></i>
              <span className="small">
                <a href="tel:+525585965748">+ (52) 55 8596 5748</a>
                <span className="split"> /</span> 49,{' '}
                <a href="tel:+525563634776">+ (52) 55 6363 4776</a>
                <span className="split"> /</span> 77
              </span>
            </div>
            <div className="d-flex align-items-center gap-2 ms-0 ms-md-5">
              <i className="bi bi-envelope fs-5"></i>
              <a className="small" href="mailto:info@hubox.com">info@hubox.com</a>
            </div>
          </div>
          <div className="d-flex align-items-center justify-content-center justify-content-md-end gap-3">
            <div className="social d-flex align-items-center gap-3 ms-md-3">
              <a href="https://www.linkedin.com/company/huboxid/?originalSubdomain=mx" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
                <i className="bi bi-linkedin fs-5"></i>
              </a>
              <a href="https://www.facebook.com/hubox.mx" aria-label="Facebook" target="_blank" rel="noopener noreferrer">
                <i className="bi bi-facebook fs-5"></i>
              </a>
              <a href="https://api.whatsapp.com/send/?phone=5638356354" aria-label="Whatsapp" target="_blank" rel="noopener noreferrer">
                <i className="bi bi-whatsapp fs-7"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
