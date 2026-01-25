import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export type UserRole = "admin" | "manager" | "receptionist" | "cochero" | "camarista" | "mantenimiento" | null;

interface UserRoleData {
  role: UserRole;
  employeeId: string | null;
  employeeName: string | null;
  userId: string | null;
  userEmail: string | null;
  isLoading: boolean;
  isValet: boolean;
  hasActiveShift: boolean;
}

export function useUserRole(): UserRoleData {
  const [role, setRole] = useState<UserRole>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setRole(null);
        setUserId(null);
        setUserEmail(null);
        setHasActiveShift(false);
        setIsLoading(false);
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || null);

      // Search for linked employee
      let { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, role")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .single();

      if (employeeError || !employee) {
        // Search by email as fallback
        const { data: employeeByEmail } = await supabase
          .from("employees")
          .select("id, first_name, last_name, role")
          .eq("email", user.email)
          .eq("is_active", true)
          .single();
        
        employee = employeeByEmail;
      }

      if (!employee) {
        setRole(null); // Valet app only for linked employees
        setHasActiveShift(false);
      } else {
        setRole(employee.role as UserRole);
        setEmployeeId(employee.id);
        setEmployeeName(`${employee.first_name} ${employee.last_name}`);

        // Check for active shift
        const { data: session } = await supabase
          .from("shift_sessions")
          .select("id")
          .eq("employee_id", employee.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        
        setHasActiveShift(!!session);
      }
    } catch (err) {
      console.error("Error fetching user role:", err);
      setHasActiveShift(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRole]);

  return {
    role,
    employeeId,
    employeeName,
    userId,
    userEmail,
    isLoading,
    isValet: role === "cochero",
    hasActiveShift,
  };
}
