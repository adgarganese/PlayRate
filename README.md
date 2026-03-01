# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Navigation: back button & swipe-back

Every screen shows **one** back control (no duplicates). Back uses stack history (`router.back()` / native back); no hardcoded routes.

| Screen / group | Header strategy |
|----------------|-----------------|
| **Root stack** (sign-in, sign-up, forgot-password, reset-password, my-sports, self-ratings, profiles, inbox, modal) | Native header (custom back removed) |
| **(tabs)** (Home, Highlights index, Courts index, etc.) | Custom header (`headerShown: false`) |
| **Courts stack** (index, court details, new, find, send-dm) | Native header |
| **Highlights stack** (index, create, highlight, send-dm, comments) | Custom header |
| **Profile stack** (index, account, highlights) | Custom header |
| **Profile → Highlights sub-stack** (My Highlights, highlight detail) | Native header |
| **Chat stack** (conversation) | Custom header |
| **Athletes stack** (user profile) | Custom header |
| **Athletes → followers / following** | Native header |

Swipe-back is enabled on all stacks (`gestureEnabled: true`). On Android, hardware/gesture back follows the same stack behavior.

## Staging / Beta Supabase (optional)

For beta, you can use a **separate Supabase project** so you can test migrations/RLS and wipe beta data without touching production.

1. **Create a second project** in [Supabase Dashboard](https://supabase.com/dashboard) (e.g. `athlete-app-staging` or `athlete-app-beta`).
2. **Run migrations on staging:** link the CLI to the staging project (`supabase link --project-ref <staging-ref>`), then run `supabase db push` (or apply migrations from `supabase/migrations/`).
3. **Point the app at staging for beta builds:** use a separate env (e.g. `.env.beta`) with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set to the staging project’s URL and anon key. Load that file when building/running the beta app (e.g. via EAS env or a script that copies `.env.beta` → `.env` for beta).
4. **Wipe staging anytime** in the Dashboard or via SQL; production is unaffected.

If you skip this for now, beta can use the current project; add staging when you want a safe place to test migrations and reset data.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
