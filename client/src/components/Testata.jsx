// Testata con il logo Handmade Café, comune alle schermate cliente.
export default function Testata({ saluto, nome }) {
  return (
    <header className="testata">
      <img src="/brand/logo.png" alt="Handmade Café" />
      {(saluto || nome) && (
        <div className="saluto">
          {saluto}
          {nome && <strong>{nome}</strong>}
        </div>
      )}
    </header>
  )
}
