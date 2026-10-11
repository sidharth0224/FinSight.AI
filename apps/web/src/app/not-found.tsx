import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>That page is out of view.</h1>
      <p>Head back to your financial workspace.</p>
      <Link href="/dashboard" className="btn btn-primary">
        Back to overview
      </Link>
    </div>
  );
}
