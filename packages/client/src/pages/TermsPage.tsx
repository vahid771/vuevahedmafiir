export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: July 2025</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-base font-semibold mb-1">1. Acceptance</h2>
          <p>
            By using Personal Life Dashboard ("the App"), you agree to these Terms of Service. If
            you do not agree, do not use the App.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">2. Use of the App</h2>
          <p>
            The App is a personal productivity tool intended for individual use. You are responsible
            for maintaining the confidentiality of your account credentials.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">3. Google Drive Integration</h2>
          <p>
            If you choose to connect your Google Drive account, you authorise the App to create and
            manage files within a dedicated folder ("Personal Life Dashboard") in your Drive. You
            can disconnect this integration at any time from the Settings page.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">4. Your Content</h2>
          <p>
            You retain full ownership of all content you create in the App. We do not claim any
            rights over your data.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">5. Availability</h2>
          <p>
            The App is provided "as is" without any warranty of uptime or availability. We reserve
            the right to modify or discontinue the App at any time.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">6. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, the developer is not liable for any loss of
            data, indirect, or consequential damages arising from your use of the App.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">7. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the App after changes
            constitutes acceptance of the new Terms.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-1">8. Contact</h2>
          <p>
            For any questions about these Terms, contact:{' '}
            <a href="mailto:vahid771@gmail.com" className="text-blue-600 underline">
              vahid771@gmail.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
