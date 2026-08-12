"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeUser = exports.getUser = exports.saveUser = exports.remove = exports.getToken = exports.saveToken = void 0;
const saveToken = (token, rememberMe) => {
    if (rememberMe) {
        localStorage.setItem("token", token);
        sessionStorage.removeItem("token");
    }
    else {
        sessionStorage.setItem("token", token);
        localStorage.removeItem("token");
    }
};
exports.saveToken = saveToken;
const getToken = () => {
    return (localStorage.getItem("token") ||
        sessionStorage.getItem("token"));
};
exports.getToken = getToken;
const remove = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
};
exports.remove = remove;
const saveUser = (user) => {
    localStorage.setItem("user", JSON.stringify(user));
};
exports.saveUser = saveUser;
const getUser = () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
};
exports.getUser = getUser;
const removeUser = () => {
    localStorage.removeItem("user");
};
exports.removeUser = removeUser;
