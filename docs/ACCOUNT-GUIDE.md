# Managing accounts and assignments

A short, practical guide for the administrator (superadmin) on creating logins and
linking them to the right people. Everything here happens on the **Users and Access**
page, which only a superadmin can see.

## The idea in one minute

There are two separate things:

1. **Account Managers** are the 25 people being assessed (the APEX TOP 25). They already
   exist in the app; you do not create them.
2. **Users** are login accounts. Every user has a **role** and, if they assess, a **lens**.

A user is linked to Account Managers through **assignments**. What that link means depends
on the lens:

- **Self**: the one Account Manager who **is** this person (their own profile). Always one.
- **Manager**: the Account Managers this person will evaluate as their line manager.
- **APEX Panel**: the Account Managers this person will evaluate as a panel member.

Rule enforced everywhere: only one evaluator per Account Manager per lens, and a self
assessor is always linked to exactly one Account Manager.

## Signing in as the administrator

1. Open the app (default: http://localhost:3010).
2. Sign in with the superadmin login (the seeded one is `vladimir` / `apex2026`).
3. In the left sidebar, open **Users and Access**.

## Creating a Self assessor (a KAM who rates themselves)

1. On **Users and Access**, go to **Create user**.
2. Fill in **Full name**, **Username**, and a **Password** (at least 6 characters).
3. Leave **Role** as **Assessor**.
4. Set **Lens** to **Self**.
5. Choose one:
   - **A new person** (default): the app creates their profile from their name, and the
     person fills in the rest (region, account, track) themselves on their first sign-in.
     Use this to build your own roster.
   - **An existing Account Manager**: pick someone already in the system.
6. Click **Create user**.

When that person signs in for the first time, a **new person** is asked to complete their
profile (name, account, region, track), then lands on their own self-assessment. After that
they always land straight on their assessment. They cannot pick or see anyone else.

## Creating a Manager assessor

1. **Create user**, fill in name, username, password.
2. Role **Assessor**, Lens **Manager**.
3. A checklist appears: **Account Managers this evaluator will assess.** Tick everyone this
   manager should evaluate.
4. Click **Create user**.

## Creating an APEX Panel assessor

Same as Manager, but set Lens to **APEX Panel**. Tick the Account Managers this panel
member will evaluate. The APEX Panel score is the authoritative one used in the analytics.

## Creating another administrator

1. **Create user**, fill in name, username, password.
2. Set **Role** to **Superadmin**. There is no lens and no Account Manager link (admins do
   not assess). Click **Create user**.

## Changing who a user is assigned to

In the **Users** table, find the person and open their **assigned** dropdown:

- For a **Self** user it is a single **own profile** selector.
- For a **Manager** or **APEX Panel** user it is the checklist of who they assess. Tick or
  untick and click **Save assignments**.

## Other actions on the Users table

- **Disable / Enable**: turns a login off or back on without deleting it. A disabled user
  cannot sign in.
- **Reset password**: set a new password for the user.
- **Delete**: permanently removes the account (with a confirm step). You cannot delete
  yourself or the last remaining superadmin. Assessments they already submitted are kept.

## What each assessor does after you create them

1. They sign in with the username and password you set.
2. **Self** users go straight to their own assessment. **Manager** and **APEX Panel** users
   see **My Assessments**, where their assigned people are listed (they can also add someone
   by typing a name).
3. They rate each capability (one per screen), and Manager / APEX Panel add one note per
   theme. They submit when done, which locks the assessment.
4. If something needs changing after submit, an administrator can reopen it from the
   individual analysis page.

## Seeing the results

Individual results and the PDF are superadmin-only.

1. Open **Individuals**, then a person, to compare Self, Manager and APEX Panel side by
   side with the gaps and theme notes.
2. Click **Export PDF** for the full report (cover, overview, written narrative, capability
   detail). The line under the button tells you whether the AI wrote the narrative.

## Trying it quickly without real people

On **Users and Access**, under **Data tools**, click **Create test sandbox**. It makes
three ready-to-use logins (`self.demo`, `manager.demo`, `panel.demo`, password `demo1234`),
all pointed at one Account Manager with a blank assessment, so you can sign in as each and
walk through the whole flow. **Load demo dataset** fills every assessment with sample
submitted scores so the dashboards and reports have data to show.
