export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: July 2025</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-base font-semibold mb-1">1. Overview</h2>
          <p>
            Personal Life Dashboard ("the App") is a personal productivity tool. This policy explains
            what data we collect, how we use it, and how we protect it.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">2. Data We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your email address and hashed password for account authentication.</li>
            <li>Content you create: tasks, bills, reminders, habits, dates, and documents.</li>
            <li>
              If you connect Google Drive: an OAuth access token and refresh token issued by Google,
              stored securely in our database and used solely to upload and manage files on your
              behalf in your own Google Drive.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">3. Google Drive Access</h2>
          <p>
            When you connect Google Drive, the App requests the{' '}
            <code className="bg-gray-100 px-1 rounded">drive.file</code> scope only. This means the
            App can only access files it has created — it cannot read, modify, or delete any other
            files in your Google Drive. You can revoke access at any time from the Settings page or
            directly from your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-blue-600 underline"
              target="_blank"
              rel="noreferrer"
            >
              Google Account permissions
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">4. How We Use Your Data</h2>
          <p>
            Your data is used exclusively to provide the App's features to you. We do not sell,
            share, or transfer your data to any third parties.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">5. Data Storage</h2>
          <p>
            Data is stored in a Turso (libSQL) database. Files uploaded via Google Drive are stored
            in your own Google Drive account — we do not store file contents on our servers.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">6. Data Deletion</h2>
          <p>
            You can delete individual documents from the App at any time. To request full account
            deletion, contact us at the email below.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">7. Contact</h2>
          <p>
            For any privacy questions, contact:{' '}
            <a href="mailto:vahid771@gmail.com" className="text-blue-600 underline">
              vahid771@gmail.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
