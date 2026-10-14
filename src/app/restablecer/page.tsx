import { Suspense } from "react";
import RestablecerForm from "./RestablecerForm";

export default function RestablecerPasswordPage() {
  return (
    <Suspense fallback={null}>
      <RestablecerForm />
    </Suspense>
  );
}
