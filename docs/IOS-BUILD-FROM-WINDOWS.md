# iOS build from Windows (no Mac) — step-by-step

Use GitHub’s Mac runner to generate the `ios` folder once. Then EAS Build can skip prebuild and your iOS build will succeed from Windows.

---

## Finish iOS setup — quick path

If you want to get to a successful EAS iOS build as fast as possible:

| # | Step | Command / action |
|---|------|-------------------|
| 1 | Repo on GitHub | Push your project to GitHub if you haven’t (see Part 1). |
| 2 | Get `ios` folder | **Option A:** Run **Actions → Prebuild iOS → Run workflow**, then `git pull`. **Option B:** If `ios` is already in the repo, just `git pull`. |
| 3 | Sentry (so build doesn’t fail) | In **app.json** and **ios/sentry.properties** replace `your-sentry-org` and `your-sentry-project` with your Sentry org/project. Ensure **SENTRY_AUTH_TOKEN** is set in EAS for production/preview. Or temporarily set **SENTRY_DISABLE_AUTO_UPLOAD** = `true` in EAS env to skip uploads. |
| 4 | Run EAS iOS build | `eas build --platform ios --profile production` (or `preview`). |

Details for each step are in the sections below.

---

## Prerequisites

- Git installed and configured (`git config user.name`, `git config user.email`).
- GitHub account.
- EAS CLI installed and logged in (`eas whoami`).
- App and credentials set up in App Store Connect / EAS.

---

## Part 1: Get your project on GitHub

### 1.1 Open a terminal in the project

```powershell
cd c:\Users\burto\OneDrive\Desktop\App\athlete-app
```

### 1.2 Check Git status

```powershell
git status
```

- If you see “not a git repository”, run:
  ```powershell
  git init
  git config user.name "Your Name"
  git config user.email "your@email.com"
  ```
- Make sure the **`ios`** folder is **not** in `.gitignore` (so we can commit it later). In this project it isn’t; only `/android` is ignored.

### 1.3 Commit everything (if you have uncommitted changes)

```powershell
git add .
git status
git commit -m "Add Prebuild iOS workflow and EAS config for iOS"
```

### 1.4 Create a repo on GitHub

1. Go to [github.com](https://github.com) and sign in.
2. Click **“+”** (top right) → **“New repository”**.
3. **Repository name:** e.g. `athlete-app` (or whatever you use).
4. **Public** or **Private** — your choice.
5. **Do not** check “Add a README”, “Add .gitignore”, or “Choose a license” (you already have a project).
6. Click **“Create repository”**.

### 1.5 Connect your local project and push

GitHub will show commands; use these (replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub username and repo name):

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

- If your default branch is already `main`, `git branch -M main` is safe. If you use another name (e.g. `master`), use that instead and push that branch.
- If GitHub asks for login, use a **Personal Access Token** (Settings → Developer settings → Personal access tokens) as the password, or sign in with GitHub in the browser if prompted.

---

## Part 2: Run the Prebuild iOS workflow (on GitHub’s Mac)

### 2.1 Open Actions

1. In your browser, go to your repo: `https://github.com/YOUR_USERNAME/YOUR_REPO`.
2. Click the **“Actions”** tab.

### 2.2 Run the workflow

1. In the left sidebar, click **“Prebuild iOS”**.
2. On the right, click **“Run workflow”**.
3. Leave the branch as **main** (or whatever branch you pushed).
4. Click the green **“Run workflow”** button.

### 2.3 Wait for it to finish

1. The run will appear at the top. Click it.
2. Click the **“prebuild”** job to see logs.
3. Wait until all steps are green (about 3–8 minutes).
4. If any step fails:
   - **“Install dependencies”** fails: ensure `package-lock.json` is committed and `npm ci` works locally.
   - **“Generate iOS project”** fails: check the log for Expo/Node errors.
   - **“Commit and push ios folder”** fails: use the artifact (see **Part 2.4** below).

### 2.4 If “Commit and push ios folder” fails (workaround)

The workflow uploads the generated **`ios`** folder as an artifact **before** trying to push. So even when the push step fails, you can get `ios` and push it yourself from your PC:

1. Open the **failed** workflow run (click the run, then the **prebuild** job).
2. Scroll to the **Artifacts** section at the bottom of the run page.
3. Download **ios-prebuilt** (it’s a zip).
4. On your PC, open the zip. It contains a single **`ios`** folder.
5. In your project folder, **delete** any existing `ios` folder (if present), then **copy** the unzipped `ios` folder into the project root (so you have `athlete-app\ios\...`).
6. Commit and push from your machine:
   ```powershell
   cd c:\Users\burto\OneDrive\Desktop\App\athlete-app
   git add ios
   git commit -m "chore: add ios from prebuild [skip ci]"
   git push origin main
   ```
7. Then run **Part 4** (EAS build) as usual.

---

## Part 3: Get the `ios` folder on your Windows PC (required before EAS build)

If you run `eas build` **without** the `ios` folder in your project, EAS will run prebuild on the server and hit:  
`EACCES: permission denied, mkdir '.../build/.expo/web'`.  
The only fix is to have `ios` in your project so EAS **skips** prebuild.

### 3.1 Pull the new commit

In your project folder:

```powershell
cd c:\Users\burto\OneDrive\Desktop\App\athlete-app
git pull origin main
```

(Use your branch name if it’s not `main`.)

You should see a new commit like: **“chore: add ios from prebuild [skip ci]”** and an **`ios`** folder in the project.

### 3.2 Confirm `ios` is there

```powershell
dir ios
```

You should see the Xcode project (e.g. `PlayRate.xcworkspace` or similar) and native files.

**Before every `eas build --platform ios`:** run `git pull` and confirm `dir ios` shows files. If `ios` is missing, the build will run prebuild and fail with EACCES.

---

## Part 4: Run an EAS iOS build

### 4.1 From the same project folder

```powershell
cd c:\Users\burto\OneDrive\Desktop\App\athlete-app
eas build --platform ios --profile production
```

- For TestFlight/internal testing you can use **`preview`** instead of **`production`**:
  ```powershell
  eas build --platform ios --profile preview
  ```

### 4.2 What EAS will do

- EAS will use your **committed** `ios` folder and **skip** the prebuild step that was failing with `EACCES` on `.expo/web`.
- The build runs in the cloud; you only need to wait for it to finish.

### 4.3 After the build

- In the EAS dashboard you’ll get a link to the build and (for production) you can submit to App Store Connect / TestFlight when ready.

---

## Summary checklist

| Step | What to do |
|------|------------|
| 1 | Open terminal in `athlete-app`, ensure Git is set up and project is committed. |
| 2 | Create a new repo on GitHub (no README/.gitignore). |
| 3 | `git remote add origin ...`, then `git push -u origin main`. |
| 4 | On GitHub: **Actions** → **Prebuild iOS** → **Run workflow** (branch: main). |
| 5 | Wait for the workflow to finish (green). |
| 6 | Locally: `git pull origin main`. |
| 7 | Check that the **`ios`** folder exists. |
| 8 | **Sentry:** Replace `your-sentry-org` / `your-sentry-project` in **app.json** and **ios/sentry.properties**, and set **SENTRY_AUTH_TOKEN** in EAS (or set **SENTRY_DISABLE_AUTO_UPLOAD** = `true` to skip uploads). See **docs/SENTRY-SETUP.md**. |
| 9 | Run: `eas build --platform ios --profile production` (or `preview`). |

---

## Before submitting to TestFlight (git commit)

**Note:** For the TestFlight run that included the tab bar / in-app video / cosign / Add Court fixes, we did **not** run `git add` / `git commit` / `git push` before building and submitting. **Next time**, commit and push before you build so the repo matches what’s in the build:

```powershell
git add .
git status
git commit -m "Your short description of changes"
git push
```

Then run `eas build` and `eas submit`. That way you have a clear commit for each TestFlight build.

---

## If something goes wrong

- **Workflow can’t push:** Make sure you’re on the correct branch and that **Settings → Actions → General** allows “Read and write permissions” for the GITHUB_TOKEN (or use a fine-grained PAT with repo write). You can still download the **ios-prebuilt** artifact and push `ios` yourself (Part 2.4).
- **EAS build still runs prebuild:** Ensure `ios` is present and committed and that you didn’t add `ios` to `.gitignore`.
- **Sentry upload fails (e.g. “Auth token is required”):** Set **SENTRY_AUTH_TOKEN** in EAS (production/preview). If you’re not ready for Sentry, set **SENTRY_DISABLE_AUTO_UPLOAD** = `true` in EAS env so the build doesn’t fail. See **docs/SENTRY-SETUP.md**.
- **EAS build fails for another reason:** Check the EAS build log (credentials, signing, or app config).

Once the **Prebuild iOS** workflow has run once and you’ve pulled the `ios` folder, you only need to run **Part 4** again for future iOS builds from Windows.
