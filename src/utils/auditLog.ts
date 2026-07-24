export const recordAuditLog = async (data: {
  username?: string;
  moduleName: string;
  actionType: string;
}) => {
  console.log("AUDIT:", data);
};