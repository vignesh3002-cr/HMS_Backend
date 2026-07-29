export const saveToken = (
  token: string,
  rememberMe: boolean
) => {

  if (rememberMe) {

    localStorage.setItem("token", token);
    sessionStorage.removeItem("token");

  } else {

    sessionStorage.setItem("token", token);
    localStorage.removeItem("token");

  }

};


export const getToken = () => {

  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token")
  );

};


export const removeToken = () => {

  localStorage.removeItem("token");
  sessionStorage.removeItem("token");

};


export const saveUser = (user: any) => {

  localStorage.setItem(
    "user",
    JSON.stringify(user)
  );

};


export const getUser = () => {

  const user = localStorage.getItem("user");

  return user ? JSON.parse(user) : null;

};


export const removeUser = () => {

  localStorage.removeItem("user");

};