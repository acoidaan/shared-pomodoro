# Shared Pomodoro

Un espacio de concentración compartido para crear salas privadas, sincronizar un
temporizador y enseñar las prioridades de cada participante en tiempo real.

## Stack

- Next.js + React
- Firebase Authentication anónima
- Cloud Firestore para salas, miembros, historial y estadísticas
- Migración automática de sesiones guardadas anteriormente en el navegador
- Vercel para el despliegue gratuito

## Desarrollo local

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. Los cambios se recargan automáticamente.

Para comprobar la versión de producción:

```bash
npm run build
npm start
```

## Configurar Firebase gratis

Firebase se utiliza para las salas reales. El plan Spark es suficiente para un
proyecto personal y no requiere añadir un método de pago.

### 1. Crear el proyecto

1. Abre <https://console.firebase.google.com/>.
2. Pulsa **Crear un proyecto**.
3. Puedes desactivar Google Analytics; no es necesario para esta aplicación.
4. Dentro del proyecto, crea una **aplicación web** desde el icono `</>`.
5. Firebase mostrará un objeto `firebaseConfig`. Conserva esos valores.

### 2. Activar identificación anónima

1. En Firebase abre **Authentication**.
2. Pulsa **Comenzar**.
3. En **Sign-in method**, activa el proveedor **Anónimo**.

Cada navegador recibirá una identidad privada sin pedir registro, correo ni
contraseña al usuario.

### 3. Crear Firestore

1. Abre **Firestore Database**.
2. Pulsa **Crear base de datos**.
3. Elige una región europea cercana.
4. Puedes iniciar en modo producción: las reglas correctas están incluidas en
   `firestore.rules`.

### 4. Variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.local.example .env.local
```

Rellena las variables con el objeto `firebaseConfig` mostrado por Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Esta configuración es pública por diseño. La seguridad depende de
`firestore.rules`, no de ocultar estos valores.

### 5. Publicar las reglas

Con Firebase CLI:

```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules
```

También puedes copiar manualmente `firestore.rules` en **Firestore → Rules** y
pulsar **Publicar**.

Reinicia `npm run dev` después de crear `.env.local`.

## Salas

- El anfitrión pulsa **Crear sala**.
- Se genera un código corto y una URL como `/room/ABC123`.
- Los invitados entran mediante el enlace o escribiendo el código.
- El anfitrión controla el temporizador.
- Todos reciben el mismo estado y la misma hora de finalización.
- Cada participante conserva su color pastel y solo edita su propia lista.
- Las listas de enfoque se muestran al resto en tiempo real.

## Historial y estadísticas

Cada sesión terminada se guarda en un historial compartido para que el grupo de
amigos pueda comparar tiempo, sesiones y actividad semanal. Si se completa
dentro de una sala, también se registra en el historial específico de esa sala.

Al abrir las estadísticas por primera vez, las sesiones antiguas de cada usuario
y los datos que todavía existan en `localStorage` se migran automáticamente una
sola vez al historial común.

Toda la persistencia y la colaboración en tiempo real utilizan Firebase. El
proyecto ya no necesita una cuenta ni variables de Supabase.

## Overlay para OBS

Dentro de una sala, el botón **Overlay OBS** abre una vista transparente con:

- Estado y fase actual.
- Tiempo restante.
- Progreso del bloque.
- Participantes activos.
- Tareas pendientes de cada persona.

En OBS añade una **Fuente de navegador** con la URL `/overlay/CODIGO`. Un tamaño
recomendado es `820 × 280`. La overlay solo observa la sala y no aparece como un
participante adicional.

## Despliegue gratuito en Vercel

1. Importa el repositorio desde <https://vercel.com/>.
2. Añade las variables `NEXT_PUBLIC_FIREBASE_*` en **Environment Variables**.
3. Despliega el proyecto.

No incluyas `.env.local` en Git. Cada `git push` a la rama configurada provocará
un nuevo despliegue automático.

## Próximos pasos

- Recuperación del control cuando el anfitrión se desconecta.
- Invitaciones directas y perfiles opcionales.
- Variantes compacta y vertical de la overlay para OBS.
