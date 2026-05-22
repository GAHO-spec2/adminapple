// admin.js PRO - Monitoreo Realtime Database

let adminUsers = {};
let adminTickets = {};
let adminCanjes = {};
let adminAlertas = {};
let clienteSeleccionadoAdmin = null;
const ROLES_ADMIN = ["admin", "gerente", "manager"];

function money(n) {
  return "$" + Number(n || 0).toFixed(2);
}

function formatDate(ts) {
  if (!ts) return "---";
  return new Date(ts).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function diasDesde(ts) {
  if (!ts) return 999;
  const hoy = Date.now();
  return Math.floor((hoy - ts) / (1000 * 60 * 60 * 24));
}

// ================= LOGIN ADMIN =================

async function loginAdmin() {
  const email = document.getElementById("emailAdmin").value.trim();
  const password = document.getElementById("passwordAdmin").value.trim();

  if (!email || !password) {
    alert("Ingresa correo y contraseña.");
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const result = await validarRolAdmin(cred.user);

    if (!result.ok) {
      await auth.signOut();
      alert("No tienes acceso al monitoreo.");
      return;
    }

    window.location.href = "admin.html";
  } catch (error) {
    console.error("Login admin error:", error);
    alert("Error al iniciar sesión: " + error.message);
  }
}

async function validarRolAdmin(user) {
  if (!user) return { ok: false };

  try {
    const snap = await rtdb.ref(`users/${user.uid}`).once("value");

    if (!snap.exists()) return { ok: false };

    const data = snap.val();
    const role = String(data.role || "").toLowerCase();

    if (data.activo === false) return { ok: false };

    return {
      ok: ROLES_ADMIN.includes(role),
      data
    };
  } catch (error) {
    console.error("Error validando admin:", error);
    return { ok: false };
  }
}

function cerrarSesionAdmin() {
  auth.signOut().then(() => {
    window.location.href = "login-admin.html";
  });
}

function togglePasswordAdmin() {
  const input = document.getElementById("passwordAdmin");
  const icon = document.querySelector(".toggle-pass");

  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    if (icon) icon.textContent = "🙈";
  } else {
    input.type = "password";
    if (icon) icon.textContent = "👁️";
  }
}

// ================= AUTH CONTROL =================

auth.onAuthStateChanged(async user => {
  const page = location.pathname.split("/").pop();

  if (!user && page !== "login-admin.html") {
    window.location.href = "login-admin.html";
    return;
  }

  if (!user) return;

  const result = await validarRolAdmin(user);

  if (!result.ok) {
    await auth.signOut();
    alert("No tienes acceso administrativo.");
    window.location.href = "login-admin.html";
    return;
  }

  if (page === "login-admin.html") {
    window.location.href = "admin.html";
    return;
  }

  iniciarMonitoreoAdmin();
});

// ================= MONITOREO =================

function iniciarMonitoreoAdmin() {
  escucharClientes();
  escucharTickets();
  escucharCanjes();
  escucharAlertas();
}

function escucharClientes() {
  rtdb.ref("users").on("value", snapshot => {
    adminUsers = snapshot.val() || {};
    renderClientes();
    renderKPIs();
  });
}

function escucharTickets() {
  rtdb.ref("tickets").on("value", snapshot => {
    adminTickets = snapshot.val() || {};
    renderTickets();
    renderKPIs();
  });
}

function escucharCanjes() {
  rtdb.ref("redemptions").on("value", snapshot => {
    adminCanjes = snapshot.val() || {};
    renderCanjes();
    renderKPIs();
  });
}

function escucharAlertas() {
  rtdb.ref("alerts").on("value", snapshot => {
    adminAlertas = snapshot.val() || {};
    renderAlertas();
    renderKPIs();
  });
}

// ================= KPIS =================

function renderKPIs() {
  const clientes = Object.values(adminUsers).filter(u => u.role === "cliente");
  const tickets = Object.values(adminTickets);
  const canjesPendientes = Object.values(adminCanjes).filter(c => c.status === "pendiente");
  const alertasPendientes = Object.values(adminAlertas).filter(a => a.status === "pendiente");

  setText("kpiClientes", clientes.length);
  setText("kpiTickets", tickets.length);
  setText("kpiCanjesPendientes", canjesPendientes.length);
  setText("kpiAlertas", alertasPendientes.length);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ================= CLIENTES =================

function renderClientes() {
  const tbody = document.getElementById("tablaClientes");
  if (!tbody) return;

  const clientes = Object.entries(adminUsers)
    .filter(([uid, u]) => u.role === "cliente")
    .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

  if (!clientes.length) {
    tbody.innerHTML = `<tr><td colspan="6">No hay clientes registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = clientes.map(([uid, u]) => `
    <tr>
      <td>${u.nombre || "Cliente"}</td>
      <td>${u.email || "---"}</td>
      <td>${money(u.saldoDisponible || 0)}</td>
      <td>${u.ticketsRegistrados || 0}</td>
      <td>${u.canjesRealizados || 0}</td>
      <td>
        <button class="btn-view" onclick="verPerfilClienteAdmin('${uid}')">
          Ver perfil
        </button>
      </td>
    </tr>
  `).join("");
}

function filtrarClientesAdmin() {
  const input = document.getElementById("buscarCliente");
  const tbody = document.getElementById("tablaClientes");

  if (!input || !tbody) return;

  const q = input.value.trim().toLowerCase();

  const clientes = Object.entries(adminUsers)
    .filter(([uid, u]) => String(u.role || "").toLowerCase() === "cliente")
    .filter(([uid, u]) => {
      if (!q) return true;

      const texto = `
        ${uid || ""}
        ${u.nombre || ""}
        ${u.email || ""}
        ${u.telefono || ""}
      `.toLowerCase();

      return texto.includes(q);
    })
    .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

  if (!clientes.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          No se encontró ningún cliente con: <strong>${q}</strong>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clientes.map(([uid, u]) => `
    <tr>
      <td>${u.nombre || "Cliente"}</td>
      <td>${u.email || "---"}</td>
      <td>${money(u.saldoDisponible || 0)}</td>
      <td>${u.ticketsRegistrados || 0}</td>
      <td>${u.canjesRealizados || 0}</td>
      <td>
        <button class="btn-view" onclick="verPerfilClienteAdmin('${uid}')">
          Ver perfil
        </button>
      </td>
    </tr>
  `).join("");
}

function limpiarBusquedaClientes() {
  const input = document.getElementById("buscarCliente");
  if (input) input.value = "";

  renderClientes();
}

// ================= TICKETS =================

function renderTickets() {
  const tbody = document.getElementById("tablaTickets");
  if (!tbody) return;

  const tickets = Object.values(adminTickets)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 50);

  if (!tickets.length) {
    tbody.innerHTML = `<tr><td colspan="6">No hay tickets registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = tickets.map(t => `
    <tr>
      <td>${formatDate(t.createdAt)}</td>
      <td>${t.clienteEmail || "---"}</td>
      <td>${t.sucursal || "---"}</td>
      <td>${t.folio || "---"}</td>
      <td>${money(t.total || 0)}</td>
      <td>${money(t.monederoGenerado || 0)}</td>
    </tr>
  `).join("");
}

// ================= CANJES =================

function renderCanjes() {
  const tbody = document.getElementById("tablaCanjesAdmin");
  if (!tbody) return;

  const canjes = Object.values(adminCanjes)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 50);

  if (!canjes.length) {
    tbody.innerHTML = `<tr><td colspan="6">No hay canjes registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = canjes.map(c => `
    <tr>
      <td>${formatDate(c.createdAt || c.redeemedAt)}</td>
      <td>${c.clienteEmail || "---"}</td>
      <td>${c.beneficio || "---"}</td>
      <td>${money(c.monto || 0)}</td>
      <td>
        <span class="badge ${c.status === "canjeado" ? "success" : "pending"}">
          ${c.status || "---"}
        </span>
      </td>
      <td>${c.sucursalCanjeNombre || c.sucursalCanje || "---"}</td>
    </tr>
  `).join("");
}

// ================= PERFIL CLIENTE =================

async function verPerfilClienteAdmin(uid) {
  clienteSeleccionadoAdmin = uid;

  const cont = document.getElementById("perfilClienteAdmin");
  const detailGrid = document.getElementById("detalleClienteAdmin");

  if (!cont) return;

  const user = adminUsers[uid];

  if (!user) {
    cont.innerHTML = "Cliente no encontrado.";
    if (detailGrid) detailGrid.style.display = "none";
    return;
  }

  const tickets = Object.values(adminTickets)
    .filter(t => t.userId === uid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const canjes = Object.values(adminCanjes)
    .filter(c => c.userId === uid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const movementsSnap = await rtdb.ref(`walletMovements/${uid}`).once("value");
  const movementsData = movementsSnap.val() || {};

  const movimientos = Object.values(movementsData)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const ultimoTicket = tickets[0];

  cont.innerHTML = `
    <div class="client-profile">
      <div class="client-avatar">
        <img src="${user.avatar || "alimento.png"}" alt="Cliente">
      </div>

      <div class="client-info">
        <h2>${user.nombre || "Cliente"}</h2>
        <p><strong>Email:</strong> ${user.email || "---"}</p>
        <p><strong>Teléfono:</strong> ${user.telefono || "---"}</p>
        <p><strong>UID:</strong> ${uid}</p>
        <p><strong>Última actividad:</strong> ${ultimoTicket ? formatDate(ultimoTicket.createdAt) : "Sin tickets"}</p>

        <div class="client-stats">
          <div class="client-stat">
            <h3>${money(user.saldoDisponible || 0)}</h3>
            <p>Saldo disponible</p>
          </div>

          <div class="client-stat">
            <h3>${tickets.length}</h3>
            <p>Tickets</p>
          </div>

          <div class="client-stat">
            <h3>${canjes.length}</h3>
            <p>Canjes</p>
          </div>

          <div class="client-stat">
            <h3>${money(user.totalGastado || 0)}</h3>
            <p>Total gastado</p>
          </div>
        </div>

        <br>

        <button class="btn-secondary" onclick="crearAlertaBonoManual('${uid}', 5)">
          Sugerir bono $5
        </button>

        <button class="btn-secondary" onclick="crearAlertaBonoManual('${uid}', 10)">
          Sugerir bono $10
        </button>
      </div>
    </div>
  `;

  if (detailGrid) detailGrid.style.display = "grid";

  renderDetalleTicketsCliente(tickets);
  renderDetalleCanjesCliente(canjes);
  renderDetalleMovimientosCliente(movimientos);
}
// ================= ALERTAS =================

function renderAlertas() {
  const lista = document.getElementById("listaAlertas");
  if (!lista) return;

  const alertas = Object.entries(adminAlertas)
    .filter(([id, a]) => a.status === "pendiente")
    .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

  if (!alertas.length) {
    lista.innerHTML = "No hay alertas pendientes.";
    return;
  }

  lista.innerHTML = alertas.map(([id, a]) => `
    <div class="alert-item">
      <h3>${a.title || "Alerta"}</h3>
      <p>${a.message || "---"}</p>
      <p><strong>Cliente:</strong> ${a.clienteEmail || "---"}</p>
      <p><strong>Bono sugerido:</strong> ${money(a.suggestedBonus || 0)}</p>

      <div class="alert-actions">
        <button class="alert-approve" onclick="aprobarAlertaBono('${id}')">
          Aprobar bono
        </button>

        <button class="alert-reject" onclick="rechazarAlerta('${id}')">
          Rechazar
        </button>
      </div>
    </div>
  `).join("");
}

async function generarAlertasInactividad() {
  const clientes = Object.entries(adminUsers).filter(([uid, u]) => u.role === "cliente");
  let creadas = 0;

  for (const [uid, user] of clientes) {
    const tickets = Object.values(adminTickets).filter(t => t.userId === uid);
    const ultimo = tickets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

    if (!ultimo) continue;

    const dias = diasDesde(ultimo.createdAt);

    if (dias < 7) continue;

    const yaExiste = Object.values(adminAlertas).some(a =>
      a.userId === uid &&
      a.type === "cliente_inactivo" &&
      a.status === "pendiente"
    );

    if (yaExiste) continue;

    const bonus = dias >= 14 ? 10 : 5;

    await rtdb.ref("alerts").push().set({
      type: "cliente_inactivo",
      title: "Cliente inactivo",
      message: `Cliente tiene ${dias} días sin registrar tickets.`,
      userId: uid,
      clienteEmail: user.email || "",
      clienteNombre: user.nombre || "",
      suggestedBonus: bonus,
      status: "pendiente",
      createdAt: Date.now()
    });

    creadas++;
  }

  alert(`Revisión terminada. Alertas creadas: ${creadas}`);
}

async function crearAlertaBonoManual(uid, monto) {
  const user = adminUsers[uid];

  if (!user) {
    alert("Cliente no encontrado.");
    return;
  }

  await rtdb.ref("alerts").push().set({
    type: "bono_manual",
    title: `Bono sugerido de ${money(monto)}`,
    message: `Se sugiere otorgar bono manual al cliente.`,
    userId: uid,
    clienteEmail: user.email || "",
    clienteNombre: user.nombre || "",
    suggestedBonus: monto,
    status: "pendiente",
    createdAt: Date.now()
  });

  alert("Alerta de bono creada.");
}

async function aprobarAlertaBono(alertId) {
  const admin = auth.currentUser;
  const alerta = adminAlertas[alertId];

  if (!admin || !alerta) {
    alert("Alerta no encontrada.");
    return;
  }

  const uid = alerta.userId;
  const monto = Number(alerta.suggestedBonus || 0);

  if (!uid || monto <= 0) {
    alert("Alerta inválida.");
    return;
  }

  const userRef = rtdb.ref(`users/${uid}`);
  const movementRef = rtdb.ref(`walletMovements/${uid}`).push();

  try {
    await userRef.transaction(data => {
      data = data || {};
      data.saldoDisponible = Number(data.saldoDisponible || 0) + monto;
      data.updatedAt = Date.now();
      return data;
    });

    await movementRef.set({
      userId: uid,
      tipo: "bono_admin",
      concepto: alerta.title || "Bono aprobado por admin",
      monto,
      createdAt: Date.now(),
      approvedBy: admin.email
    });

    await rtdb.ref(`alerts/${alertId}`).update({
      status: "aprobada",
      approvedBy: admin.email,
      approvedAt: Date.now()
    });

    await rtdb.ref("auditLogs").push().set({
      type: "BONO_APROBADO",
      alertId,
      userId: uid,
      monto,
      adminEmail: admin.email,
      createdAt: Date.now()
    });

    alert("Bono aprobado y aplicado al cliente.");

  } catch (error) {
    console.error("Error aprobando bono:", error);
    alert("No se pudo aprobar el bono.");
  }
}

async function rechazarAlerta(alertId) {
  const admin = auth.currentUser;

  if (!admin) return;

  await rtdb.ref(`alerts/${alertId}`).update({
    status: "rechazada",
    rejectedBy: admin.email,
    rejectedAt: Date.now()
  });

  await rtdb.ref("auditLogs").push().set({
    type: "ALERTA_RECHAZADA",
    alertId,
    adminEmail: admin.email,
    createdAt: Date.now()
  });

  alert("Alerta rechazada.");
}

function renderDetalleTicketsCliente(tickets) {
  const cont = document.getElementById("detalleTicketsCliente");
  if (!cont) return;

  if (!tickets.length) {
    cont.innerHTML = "Sin tickets registrados.";
    return;
  }

  cont.innerHTML = tickets.slice(0, 20).map(t => `
    <div class="detail-item">
      <strong>Ticket ${t.folio || "---"}</strong>
      <p><b>Fecha consumo:</b> ${t.fechaTicket || "---"}</p>
      <p><b>Sucursal:</b> ${t.sucursal || "---"}</p>
      <p><b>Total:</b> ${money(t.total || 0)}</p>
      <p><b>Monedero generado:</b> ${money(t.monederoGenerado || 0)}</p>
      <p><b>Status:</b> ${t.status || "---"}</p>
      <p><b>Registrado:</b> ${formatDate(t.createdAt)}</p>
    </div>
  `).join("");
}

function renderDetalleCanjesCliente(canjes) {
  const cont = document.getElementById("detalleCanjesCliente");
  if (!cont) return;

  if (!canjes.length) {
    cont.innerHTML = "Sin canjes registrados.";
    return;
  }

  cont.innerHTML = canjes.slice(0, 20).map(c => `
    <div class="detail-item">
      <strong>${c.beneficio || "Canje"}</strong>
      <p><b>Monto:</b> ${money(c.monto || 0)}</p>
      <p><b>Status:</b> ${c.status || "---"}</p>
      <p><b>Creado:</b> ${formatDate(c.createdAt)}</p>
      <p><b>Canjeado:</b> ${formatDate(c.redeemedAt)}</p>
      <p><b>Gerente:</b> ${c.gerenteEmail || "---"}</p>
      <p><b>Sucursal:</b> ${c.sucursalCanjeNombre || c.sucursalCanje || "---"}</p>
    </div>
  `).join("");
}

function renderDetalleMovimientosCliente(movimientos) {
  const cont = document.getElementById("detalleMovimientosCliente");
  if (!cont) return;

  if (!movimientos.length) {
    cont.innerHTML = "Sin movimientos.";
    return;
  }

  cont.innerHTML = movimientos.slice(0, 25).map(m => `
    <div class="detail-item">
      <strong>${m.concepto || m.tipo || "Movimiento"}</strong>
      <p><b>Monto:</b> ${money(m.monto || 0)}</p>
      <p><b>Tipo:</b> ${m.tipo || "---"}</p>
      <p><b>Fecha:</b> ${formatDate(m.createdAt)}</p>
      <p><b>Aprobado por:</b> ${m.approvedBy || "---"}</p>
    </div>
  `).join("");
}
async function aplicarAjusteMonederoAdmin() {
  const admin = auth.currentUser;

  if (!admin) {
    alert("Sesión no válida.");
    return;
  }

  if (!clienteSeleccionadoAdmin) {
    alert("Selecciona primero un cliente.");
    return;
  }

  const monto = Number(document.getElementById("ajusteMonto").value);
  const motivo = document.getElementById("ajusteMotivo").value.trim();

  if (!monto || !motivo) {
    alert("Ingresa monto y motivo.");
    return;
  }

  const confirmar = confirm(
    `¿Confirmas aplicar ajuste de ${money(monto)}?\n\nMotivo: ${motivo}`
  );

  if (!confirmar) return;

  const userRef = rtdb.ref(`users/${clienteSeleccionadoAdmin}`);
  const movementRef = rtdb.ref(`walletMovements/${clienteSeleccionadoAdmin}`).push();

  try {
    await userRef.transaction(data => {
      data = data || {};
      data.saldoDisponible = Number(data.saldoDisponible || 0) + monto;
      data.updatedAt = Date.now();
      return data;
    });

    await movementRef.set({
      userId: clienteSeleccionadoAdmin,
      tipo: monto > 0 ? "ajuste_admin_abono" : "ajuste_admin_cargo",
      concepto: motivo,
      monto,
      createdAt: Date.now(),
      approvedBy: admin.email
    });

    await rtdb.ref("auditLogs").push().set({
      type: "AJUSTE_MONEDERO_ADMIN",
      userId: clienteSeleccionadoAdmin,
      monto,
      motivo,
      adminEmail: admin.email,
      createdAt: Date.now()
    });

    document.getElementById("ajusteMonto").value = "";
    document.getElementById("ajusteMotivo").value = "";

    alert("Ajuste aplicado correctamente.");

    verPerfilClienteAdmin(clienteSeleccionadoAdmin);

  } catch (error) {
    console.error("Error aplicando ajuste:", error);
    alert("No se pudo aplicar el ajuste.");
  }
}
